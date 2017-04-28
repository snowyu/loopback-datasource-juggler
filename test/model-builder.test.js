// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';
var should = require('./init.js');
var assert = require('assert');

var jdb = require('../');
var ModelBuilder = jdb.ModelBuilder;
var DataSource = jdb.DataSource;
var Memory = require('../lib/connectors/memory');

var ModelDefinition = require('../lib/model-definition');

describe('ModelBuilder class', function() {
  var memory;
  beforeEach(function() {
    memory = new DataSource({connector: Memory});
  });

  context('Model inheritance', function() {
    it('should inherit prototype using option.base', function() {
      var modelBuilder = memory.modelBuilder;
      var parent = memory.createModel('parent', {}, {
        relations: {
          children: {
            type: 'hasMany',
            model: 'anotherChild',
          },
        },
      });
      var baseChild = modelBuilder.define('baseChild');
      baseChild.attachTo(memory);
    // the name of this must begin with a letter < b
    // for this test to fail
      var anotherChild = baseChild.extend('anotherChild');

      assert(anotherChild.prototype instanceof baseChild);
    });

    it('should ignore inherited options.base', function() {
      var modelBuilder = memory.modelBuilder;
      var base = modelBuilder.define('base');
      var child = base.extend('child', {}, {base: 'base'});
      var grandChild = child.extend('grand-child');
      assert.equal('child', grandChild.base.modelName);
      assert(grandChild.prototype instanceof child);
    });

    it('should ignore inherited options.super', function() {
      var modelBuilder = memory.modelBuilder;
      var base = modelBuilder.define('base');
      var child = base.extend('child', {}, {super: 'base'});
      var grandChild = child.extend('grand-child');
      assert.equal('child', grandChild.base.modelName);
      assert(grandChild.prototype instanceof child);
    });

    it('merge policy `{rank: true}` ranks settings arrays elements ' +
      'according to model\s inheritance rank', function() {
      var modelBuilder = memory.modelBuilder;
      var modelRank1 = modelBuilder.define('modelRank1', {}, {acls: [
        {
          principalType: 'ROLE',
          principalId: '$everyone',
          property: 'oneMethod',
          permission: 'ALLOW',
        },
      ]});
      var modelRank2 = modelBuilder.define('modelRank2', {}, {
        base: modelRank1,
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$owner',
            property: 'anotherMethod',
            permission: 'ALLOW',
          },
        ],
        enableOptionatedModelMerge: true,
      });
      var modelRank3 = modelRank2.extend('modelRank3', {}, {});
      var modelRank4 = modelRank3.extend('modelRank4', {}, {
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'DENY',
          },
        ],
        enableOptionatedModelMerge: true,
      });

      var expectedSettings = {
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'ALLOW',
            rank: 1,
          },
          {
            principalType: 'ROLE',
            principalId: '$owner',
            property: 'anotherMethod',
            permission: 'ALLOW',
            rank: 2,
          },
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'DENY',
            rank: 4,
          },
        ],
      };
      should.deepEqual(modelRank4.settings.acls, expectedSettings.acls);
    });

    it('merge policy `{replace: true}` replaces baseClass array with subClass ' +
      'matching array', function() {
      // merge policy of settings.description is {replace: true}
      var modelBuilder = memory.modelBuilder;
      var base = modelBuilder.define('base', {}, {
        description: ['base', 'model', 'description'],
      });
      var child = base.extend('child', {}, {
        description: ['this', 'is', 'child', 'model', 'description'],
        enableOptionatedModelMerge: true,
      });

      var expectedSettings = {
        description: ['this', 'is', 'child', 'model', 'description'],
      };

      should.deepEqual(child.settings.description, expectedSettings.description);
    });

    it('merge policy `{replace: false}` adds distinct members of matching arrays ' +
      'from baseClass and subClass', function() {
      // merge policy of settings.hidden is {replace: false}
      var modelBuilder = memory.modelBuilder;
      var base = modelBuilder.define('base', {}, {
        hidden: ['firstProperty', 'secondProperty'],
      });
      var child = base.extend('child', {}, {
        hidden: ['secondProperty', 'thirdProperty'],
      });

      var expectedSettings = {
        hidden: ['firstProperty', 'secondProperty', 'thirdProperty'],
      };

      should.deepEqual(child.settings.hidden, expectedSettings.hidden);
    });

    it('merge policy `{patch: true}` adds distinct inner properties of matching ' +
      'objects from baseClass and subClass', function() {
      // merge policy of settings.relations is {patch: true}
      var modelBuilder = memory.modelBuilder;
      var base = modelBuilder.define('base', {}, {
        relations: {
          someOtherRelation: {
            type: 'hasMany',
            model: 'someOtherModel',
            foreignKey: 'otherModelId',
          },
        },
      });
      var child = base.extend('child', {}, {
        relations: {
          someRelation: {
            type: 'belongsTo',
            model: 'someModel',
            foreignKey: 'modelId',
          },
        },
      });

      var expectedSettings = {
        relations: {
          someRelation: {
            type: 'belongsTo',
            model: 'someModel',
            foreignKey: 'modelId',
          },
          someOtherRelation: {
            type: 'hasMany',
            model: 'someOtherModel',
            foreignKey: 'otherModelId',
          },
        },
      };

      should.deepEqual(child.settings.relations, expectedSettings.relations);
    });

    it('merge policy `{patch: true}` replaces baseClass inner properties with ' +
      'matching subClass inner properties', function() {
      // merge policy of settings.relations is {patch: true}
      var modelBuilder = memory.modelBuilder;
      var base = modelBuilder.define('base', {}, {
        relations: {
          user: {
            type: 'belongsTo',
            model: 'User',
            foreignKey: 'userId',
          },
        },
      });
      var child = base.extend('child', {}, {
        relations: {
          user: {
            type: 'belongsTo',
            idName: 'id',
            polymorphic: {
              idType: 'string',
              foreignKey: 'userId',
              discriminator: 'principalType',
            },
          },
        },
        enableOptionatedModelMerge: true,
      });

      var expectedSettings = {
        relations: {
          user: {
            type: 'belongsTo',
            idName: 'id',
            polymorphic: {
              idType: 'string',
              foreignKey: 'userId',
              discriminator: 'principalType',
            },
          },
        },
      };

      should.deepEqual(child.settings.relations, expectedSettings.relations);
    });
  });
});
