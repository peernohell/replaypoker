Session.setDefault('view', 'users');

UI.registerHelper('chip', function (chip) {
  return chip.toLocaleString() + '&nbsp;<span class="fa fa-empire"></span>';
});

Template.tables.nbTables = function () {
  return Tables.find().count();
};

Template.tables.tables = function () {
  return Tables.find({},{sort: {'updatedAt': -1}, limit: 20});
};

Template.users.nbUsers = function () {
  return Users.find({},{fields: {_id: 1}}).count();
};

Template.users.users = function () {
  //return Users.find({},{sort: {winChips: -1}, limit: 10});
  return Users.find({},{limit: 200});
};

Template.users.events({
  'click div.user': function () {
    Session.set('view', 'userDetail');
    Session.set('viewData', Users.findOne({id: this.id}));
  }
});

Template.users.userAvatar = function (user) {
  var url = user.avatar;
  if (/^\//.test(url))
    url = '//www.replaypoker.com' + url;

  return url;
};

Template.userHistories.histories = function () {
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

UI.body.events({
  'click input#players': function () {
    Session.set('view', 'users');
  },
  'click input#tables': function () {
    Session.set('view', 'tables');
  }
});

Template.table.nbPlayers = function () {
  return this.seats ? this.seats.length : 0;
};
