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

  describe('Model inheritance', function() {
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

    describe('merge policy with flag `configurableModelMerge`', function() {
      describe('ModelBaseClass.getMergePolicy()', function() {
        const defaultMergePolicy = {
          description: {replace: true},
          options: {patch: true},
          properties: {patch: true},
          hidden: {replace: false},
          protected: {replace: false},
          indexes: {patch: true},
          methods: {patch: true},
          mixins: {patch: true},
          relations: {patch: true},
          scope: {replace: true},
          scopes: {patch: true},
          acls: {rank: true},
          __delete: null,
          __default: {replace: true},
        };

        let modelBuilder, base;

        beforeEach(function() {
          modelBuilder = memory.modelBuilder;
          base = modelBuilder.define('base');
        });

        it('returns default merge policy', function() {
          const mergePolicy = base.getMergePolicy();
          should.deepEqual(mergePolicy, defaultMergePolicy);
        });

        it('handles custom merge policy defined via model.settings', function() {
          const newMergePolicy = {
            relations: {patch: true},
          };
          // defining a new merge policy with model.settings
          base.settings.mergePolicy = newMergePolicy;
          const mergePolicy = base.getMergePolicy();
          should.deepEqual(mergePolicy, newMergePolicy);
        });

        it('can be extended by user', function() {
          const alteredMergePolicy = Object.assign({}, defaultMergePolicy, {
            __delete: false,
          });
          // extending the builtin getMergePolicy function
          base.getMergePolicy = function() {
            const origin = base.base.getMergePolicy();
            return Object.assign({}, origin, {
              __delete: false,
            });
          };
          const mergePolicy = base.getMergePolicy();
          should.deepEqual(mergePolicy, alteredMergePolicy);
        });

        it('is inherited by child model', function() {
          const newMergePolicy = {
            relations: {patch: true},
          };
          // defining a new merge policy on base with model.settings
          base.settings.mergePolicy = newMergePolicy;
          const child = base.extend('child');
          // get mergePolicy from child
          const mergePolicy = child.getMergePolicy();
          should.deepEqual(mergePolicy, newMergePolicy);
        });
      });

      describe('merge policy settings', function() {
        it('`{__delete: null}` allows deleting base model settings by assigning ' +
        'null value at sub model level', function() {
          var modelBuilder = memory.modelBuilder;
          var base = modelBuilder.define('base', {}, {
            anyParam: {oneKey: 'this should be removed'},
          });
          var child = base.extend('child', {}, {
            anyParam: null,
            configurableModelMerge: true,
          });

          var expectedSettings = {};

          should.deepEqual(child.settings.description, expectedSettings.description);
        });

        it('`{rank: true}` defines rank of array elements ' +
        'according to model\'s inheritance rank', function() {
          var modelBuilder = memory.modelBuilder;
          var base = modelBuilder.define('base', {}, {acls: [
            {
              principalType: 'ROLE',
              principalId: '$everyone',
              property: 'oneMethod',
              permission: 'ALLOW',
            },
          ]});
          var childRank1 = modelBuilder.define('childRank1', {}, {
            base: base,
            acls: [
              {
                principalType: 'ROLE',
                principalId: '$owner',
                property: 'anotherMethod',
                permission: 'ALLOW',
              },
            ],
            configurableModelMerge: true,
          });
          var childRank2 = childRank1.extend('childRank2', {}, {});
          var childRank3 = childRank2.extend('childRank3', {}, {
            acls: [
              {
                principalType: 'ROLE',
                principalId: '$everyone',
                property: 'oneMethod',
                permission: 'DENY',
              },
            ],
            configurableModelMerge: true,
          });

          var expectedSettings = {
            acls: [
              {
                principalType: 'ROLE',
                principalId: '$everyone',
                property: 'oneMethod',
                permission: 'ALLOW',
                __rank: 1,
              },
              {
                principalType: 'ROLE',
                principalId: '$owner',
                property: 'anotherMethod',
                permission: 'ALLOW',
                __rank: 2,
              },
              {
                principalType: 'ROLE',
                principalId: '$everyone',
                property: 'oneMethod',
                permission: 'DENY',
                __rank: 4,
              },
            ],
          };
          should.deepEqual(childRank3.settings.acls, expectedSettings.acls);
        });

        it('`{replace: true}` replaces base model array with sub model matching ' +
        'array', function() {
          // merge policy of settings.description is {replace: true}
          var modelBuilder = memory.modelBuilder;
          var base = modelBuilder.define('base', {}, {
            description: ['base', 'model', 'description'],
          });
          var child = base.extend('child', {}, {
            description: ['this', 'is', 'child', 'model', 'description'],
            configurableModelMerge: true,
          });

          var expectedSettings = {
            description: ['this', 'is', 'child', 'model', 'description'],
          };

          should.deepEqual(child.settings.description, expectedSettings.description);
        });

        it('`{replace:true}` is applied on array parameters not defined in merge policy', function() {
          var modelBuilder = memory.modelBuilder;
          var base = modelBuilder.define('base', {}, {
            unknownArrayParam: ['this', 'should', 'be', 'replaced'],
          });
          var child = base.extend('child', {}, {
            unknownArrayParam: ['this', 'should', 'remain', 'after', 'merge'],
            configurableModelMerge: true,
          });

          var expectedSettings = {
            unknownArrayParam: ['this', 'should', 'remain', 'after', 'merge'],
          };

          should.deepEqual(child.settings.description, expectedSettings.description);
        });

        it('`{replace:true}` is applied on object {} parameters not defined in mergePolicy', function() {
          var modelBuilder = memory.modelBuilder;
          var base = modelBuilder.define('base', {}, {
            unknownObjectParam: {oneKey: 'this should be replaced'},
          });
          var child = base.extend('child', {}, {
            unknownObjectParam: {anotherKey: 'this should remain after merge'},
            configurableModelMerge: true,
          });

          var expectedSettings = {
            unknownObjectParam: {anotherKey: 'this should remain after merge'},
          };

          should.deepEqual(child.settings.description, expectedSettings.description);
        });

        it('`{replace: false}` adds distinct members of matching arrays from ' +
        'base model and sub model', function() {
          // merge policy of settings.hidden is {replace: false}
          var modelBuilder = memory.modelBuilder;
          var base = modelBuilder.define('base', {}, {
            hidden: ['firstProperty', 'secondProperty'],
          });
          var child = base.extend('child', {}, {
            hidden: ['secondProperty', 'thirdProperty'],
            configurableModelMerge: true,
          });

          var expectedSettings = {
            hidden: ['firstProperty', 'secondProperty', 'thirdProperty'],
          };

          should.deepEqual(child.settings.hidden, expectedSettings.hidden);
        });

        it('`{patch: true}` adds distinct inner properties of matching objects ' +
        'from base model and sub model', function() {
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
            configurableModelMerge: true,
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

        it('`{patch: true}` replaces baseClass inner properties with matching ' +
        'subClass inner properties', function() {
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
            configurableModelMerge: true,
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
  });
});
