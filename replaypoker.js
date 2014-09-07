Tables = new Meteor.Collection('tables');
Users = new Meteor.Collection('users');
Histories = new Meteor.Collection('histories');

if (Meteor.isClient) {
  Session.setDefault('view', 'users');

  Template.tables.nbTables = function () {
    return Tables.find().count();
  };

  Template.tables.tables = function () {
    return Tables.find({},{sort: {'updatedAt': -1}, limit: 20});
  };

  Template.users.nbUsers = function () {
    return Users.find().count();
  };

  Template.users.users = function () {
    return Users.find({},{sort: {'winChips': -1}, limit: 20});
  };

  Template.users.events({
    'click div.user': function () {
      Session.set('view', 'user');
      Session.set('viewData', Users.findOne({id: this.id}));
    }
  });

  Template.users.userAvatar = function (user) {
    var url = user.avatar;
    if (/^\//.test(url))
      url = '//www.replaypoker.com' + url;

    return url;
  };

  Template.user.tableHistories = function () {
    return Histories.find({userId: this.id});
  };

  Template.user.userAvatar = function () {
    var url = this.avatar;
    if (/^\//.test(url))
      url = '//www.replaypoker.com' + url;

    return url;
  };

  Template.user.nbTableHistories = function () {
    return Histories.find({userId: this.id}).count();
  };


  Template.userTableHistories.chart = function (tabHistory) {
    var str = '<div id="chart_tab_' + tabHistory.tableId + '"></div>';
    setTimeout(function () {
      var chart = c3.generate({
        bindto: '#chart_tab_' + tabHistory.tableId,
        data: {
          x: 'x',
          columns: [
            ['x'].concat(tabHistory.histories.map(function (h) {return h.date;})),
            ['chips'].concat(tabHistory.histories.map(function (h) {return h.chips;}))
          ]
        },
        axis: {
          x: {
            type: 'timeseries',
            tick: {
              format: '%Y-%m-%d',
              culling: {max: 4}
            }
          }
        },
        bar: {
          width: {
            ratio: 0.5 // this makes bar width 50% of length between ticks
          }
          // or
          //width: 100 // this makes bar width 100px
        }
      });
    }, 100);
    return str;
  };

  Template.userTableHistories.rendered = function () {
    console.log('userTableHistories rendered. generate c3');
  }

  Template.main.view = function () {
    return Session.get('view');
  };

  Template.main.viewData = function () {
    return Session.get('viewData');
  };

  Template.main.events({
    'click input#players': function () {
      Session.set('view', 'users');
    },
    'click input#tables': function () {
      Session.set('view', 'tables');
    },
    'click input#update': function () {
      // template data, if any, is available in 'this'
      Meteor.call('update', 'rings', function (err, data) {
        if (err) throw err;
        console.log(data);
      });
      
    }
  });

  Template.table.nbPlayers = function () {
    return this.seats ? this.seats.length : 0;
  };
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });

  function convertSeats(seats) {
    return seats.reduce(function (seats, s) {
      if (s.id) seats.push({id: s.id, username: s.username});
      return seats
    }, []);
  }

  function createHistoryFromTable (table) {
    return {
      date: new Date(),
      playersIds: table.playersIds,
      seats: convertSeats(table.seats)
    };
  }

  function createHistoryFromUser (user, tableId) {
    return {
      date: new Date(),
      chips: user.chips
    };
  }

  function isSameTableHistory(a, b) {
    return a.playersIds.join(',') === b.playersIds.join(',')
       && a.seats.join(',') === b.seats.join(',');
  }

  function isSameUserHistory(a, b) {
    return a.chips === b.chips
       && a.tableId === b.tableId;
  }

  function saveOrUpdateTable (table) {
    // find if table is already in collection.
    var toUpdateTable = Tables.findOne({id: table.id});
    if (toUpdateTable) {
      updateTable(toUpdateTable, table);
    } else {
      saveTable(table);
    }
  }


  function saveOrUpdateTableAndUser (table) {
    saveOrUpdateTable(table);
    table.seats.filter(function (s) {
        return !!s.id;
    }).forEach(function (user) {
      saveOrUpdateUser(user, table);
    });
  }

  function saveOrUpdateUser (user, table) {
    var toUpdateUser = Users.findOne({id: user.id}, {fields: {id: 1}});
    if (toUpdateUser) {
      updateUser(user, table);
    } else {
      saveUser(user, table);
    }
  }

  function saveTable(table) {
    var
      newTable = {},
      fields = ['id', 'url', 'description', 'fast', 'name', 'password', 'closed', 'type', 'blinds', 'avgPot', 'avgStack'];

    newTable.tableSeats = table.seats.length;
    fields.forEach(function (field) {newTable[field] = table[field];});

    newTable.histories = [createHistoryFromTable(table)];
    newTable.seats = newTable.histories[0].seats

    Tables.insert(newTable);
  }

  function saveUser(user, table) {
    var
      newUser = {},
      history = {},
      fields = ['id', 'username', 'avatar', 'flag', 'url'];

    fields.forEach(function (field) {newUser[field] = user[field];});

    newUser.avgChips = 0;
    newUser.winChips = 0;

    Users.insert(newUser);

    history.userId = user.id;
    history.userName = user.username;
    history.tableId = table.id;
    history.tableName = table.name;
    history.last = createHistoryFromUser(user, table.id);
    history.last.winChips = 0;
    history.histories = [history.last];
    history.winChips = 0;
    Histories.insert(history);
  }

  function updateTable(table, newTable) {
    var
      newHistory = createHistoryFromTable(newTable),
      lastHistory = table.histories ? table.histories[table.histories.length - 1] : null;

    if (lastHistory !== null && isSameTableHistory(lastHistory, newHistory)) return;

    Tables.update(table, {$push: { histories: newHistory}, $set: {seats: newHistory.seats, updatedAt: new Date()}});
  }

  function updateUser(user, table) {
    var
      ids = {userId: user.id, tableId: table.id},
      newHistory = createHistoryFromUser(user, table.id),
      lastHistory = Histories.findOne(ids, {fields: {last: 1, winChips: 1}}),
      userAvgChips = 0,
      totalTable = 1,
      winChips = 0,
      totalWinChips = 0;

    if (!lastHistory) {
      
      newHistory.winChips = 0;
      Histories.insert({
        userId: user.id,
        userName: user.username,
        tableId: table.id,
        tableName: table.name,
        last: newHistory,
        winChips: 0,
        histories: [newHistory]
      });
      return;

    } else if (isSameUserHistory(lastHistory.last, newHistory)) {
      return;
    }

    newHistory.winChips = newHistory.chips - lastHistory.last.chips;
    winChips = lastHistory.last.winChips + newHistory.winChips;


    totalWinChips = winChips;
    Histories.find({userId: user.id}, {fields: {winChips: 1}}).fetch().forEach(function (h) {
      totalWinChips += h.winChips;
      totalTable++;
    }); 

    Users.update({id: user.id}, {$set:{avgChips: (totalWinChips/totalTable)|0, winChips: totalWinChips}});
    Histories.update(ids, {$push: {histories: newHistory}, $set: {last: newHistory, winChips: winChips}});

  }

  Meteor.methods({
    update: function (toUpdate) {
      toUpdate = toUpdate || 'rings';
      this.unblock();
      var result = HTTP.get('http://www.replaypoker.com/' + toUpdate);
      if (result.statusCode === 304) return result; // nothing change so we do not update database.

      result.data[toUpdate].forEach(saveOrUpdateTableAndUser);

      return result;

    }
  });
}