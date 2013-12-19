/*
 * File: MC/data/BaseModel.js
 *
 * Override of Ext.data.Model to support inline associated data in Xtemplates and Forms
 * Modified from https://github.com/robboerman/SenchaAssociationsPart1 to work with ExtJS 4
 * 
 	HISTORY

		17-Sep-2013		JT McGibbon
			Change linkAssociations function:
				- associations.getName to associations.name
				- associations.getType to associations.type
				
		01-Nov-2013		JT McGibbon
			Merged in MC.data.Model methods (ModusCreate GitHub: https://github.com/ModusCreateOrg/modus-create-sencha-plugin-pack/tree/master/MC/data
			for writing heirarchy out on save:
			 * Works in conjunction with MC.data.JsonWriter to provide structured payloads during write operations. It will use
			 * the Model's mapping fields to build the payload rather than sending a flattened object. This will provide a solid
			 * base that should cover most use cases. Any Model can override this behavior as needed.
			 *
			 * Additionally this allows for hasMany and hasOne associations to be written in the same operation and using the same
			 * structured payload approach. Associations also can now have different names in read and write operations: specify
			 * both writeName and name if this behavior is needed.
			 *
			 * The default behavior of Ext JS is to use each field's persist property to determine whether it should be written.
			 * Any fields marked with persist false will be ignored. In create operations, all persistable fields are written and
			 * in update operations, only changes are written. We have added support for a forcePersist property to mark fields
			 * that should be written on update operations even if they have not changed.
			 
		01-Nov-2013		JT McGibbon
			Added new setFlattenedData(data) method to allow updating of model using form data created using getFlattenedData approach (dot notation names)
			or another baseModels getFlattenedData(true) output.
			* Typical Usage: yourBaseModelInstance.setFlattenedData(form.getValues())	

		05-Nov-2013		JT McGibbon
			Bug Fix: If hasMany associated store has records that are not dirty, do not increment the data array counter to
					 ensure that null array componets are not posted
			
		08-Nov-2013		JT McGibbon
			** NOTE:  Removed due to rest error from CFML side -- need to fix first
				Incorporated 4.2.2 Bug fix to use idProperty (the load() method in Ext4.2 wont work unless the id property is 'id'.)
				Thanks to Forum user murrah (http://www.sencha.com/forum/member.php?13192-murrah)
				and this forum item: Solved: Ext.data.Model - persisting data via proxy and without a store 
				Link: 
					http://www.sencha.com/forum/showthread.php?275404-Solved-Ext.data.Model-persisting-data-via-proxy-and-without-a-store&p=1008982#post1008982
 */
Ext.define("MC.data.BaseModel", {
	extend: 'Ext.data.Model',

	linkedAssociations: false,
    writeStructuredData: true,
	writeAllFields: true,

	config: {
		// Use uuid strategy for creating new ids
		identifier: {
            type: 'uuid'
        }
	},
/* 	4.2.2 Bug fix
   statics: { 

        load: function(id, config) { 
            //console.log('in bux.model load') 

            config = Ext.apply({}, config); 

                // Added this 
            var params={}; 
            params[this.prototype.idProperty] = id; 

            config = Ext.applyIf(config, { 
              action: 'read', 
              params: params 
            }); 
                // end Added 
               
              // Removed this             
             // config = Ext.applyIf(config, { 
              //  action: 'read', 
              //  id    : id 
            //});

            var operation  = new Ext.data.Operation(config), 
                scope      = config.scope || this, 
                callback; 

            callback = function(operation) { 
                var record = null, 
                    success = operation.wasSuccessful(); 
                 
                if (success) { 
                    record = operation.getRecords()[0]; 
                    // If the server didn't set the id, do it here 
                    if (!record.hasId()) { 
                        record.setId(id); 
                    } 
                    Ext.callback(config.success, scope, [record, operation]); 
                } else { 
                    Ext.callback(config.failure, scope, [record, operation]); 
                } 
                Ext.callback(config.callback, scope, [record, operation, success]); 
            }; 

            this.getProxy().read(operation, callback, this); 
        }         
    },
*/
	inheritableStatics: {

		/**
		 * The relation path mapper.
		 *
		 * @return A map of all the objects this model has relations to en their possible paths.
		 */
		// TODO: check if we really want to cache this.
		getAllPaths: function() {
			var name;
			if(this.pathHistory) {
				return this.pathHistory;
			}
			this.pathHistory = { };

			name = this.modelName.substr(this.modelName.lastIndexOf('.') + 1);
			this.pathHistory[name] = {
				paths:  [ [ name ] ]
			};

			this._getPaths(this, name, this.pathHistory);
			return this.pathHistory;
		},

		_getPaths: function(root, mypath, history) {
			var i, asoc, asocModel, name, sub;
			// hasMany, belongsTo, hasOne
			if(this.associations) {
				// For every association.
				for(i = 0; i < this.associations.all.length; i += 1) {
					asoc = this.associations.all[i].config;
					asocModel = Ext.ModelManager.getModel(asoc.associatedModel);
					name = asoc.name;

					sub = mypath + '.';
					// We already know this object in our current path.
					if(sub.search(new RegExp("(\\.|^)"+name+"\\.","g")) !== -1) {
						continue;
					}

					sub += name;
					// New path, record and descend.
					if(!history[name] || !this._contains(history[name].paths, sub)) {
						history[name] = history[name] ||  { paths: [] };
						// Add a new path to object 'name' to list of paths to the object.
						history[name].paths.push(sub.split('.'));
						asocModel._getPaths(root, sub, history); // Descend.
					}
				}
			}
		},

		getModelName: function() {
			var name = this.getName();
			return name.substr(name.lastIndexOf('.') + 1);
		},

		_contains: function(array, value) {
			var i;
			for(i = 0; i < array.length; i += 1) {
				if(array[i] === value) {
					return true;
				}
			}
			return false;
		}
	},

	getModelName: function() {
		return this.self.getModelName();
	},

	/**
	 * Finds all associated records belonging to this instance.
	 *
	 * this uses the pathMapper and first path found from this object to it's destination.
	 * this uses a step by step finder using memory resident records.
	 * For every part in path
	 *   get all records in current level from records from previous level
	 *
	 * Start level is the starting instance [ this ]
	 *
	 * @param modelName to find all records from.
	 * @return {Array} of associated records.
	 */
	getAssociatedRecords: function(modelName) {
		var i, o, asoc, list, newList, split, paths = this.self.getAllPaths(), parent;
		if(!paths[modelName]) {
			throw new Error('There is no path between ' + this.getModelName() + ' and ' + modelName);
		}

		split = paths[modelName].paths[0];
		list = [ this ]; // Start level
		newList = []; // Next level.
		// Skip the first entry(self);
		for(i = 1; i < split.length; i += 1) { // Descend.
			if(list.length === 0) {
				return [];
			}
			// Find association for this level
			asoc = list[0].associations.get(split[i]);
			if(!asoc) {
				throw new Error('Cannot find association ' + split[i] + ' on ' + list[0].getModelName());
			}

			// Get all sub records from current level.
			for(o = 0; o < list.length; o += 1) {
				if(asoc.getType().toLowerCase() === 'hasmany') {
					newList = newList.concat(list[o].getChildren(split[i]));
				} else {
					parent = list[o].getParent(split[i]);
					if(parent !== null) {
						newList.push(parent);
					}
				}
			}
			list = newList; // Move next level to current level.
			newList = [];
		}
		return list;
	},

	/* uses information from the associations to fetch a parent from an associated store */
	getParent: function(assocName) {
		var assoc = this.associations.get(assocName);
		if (!assoc) {
			return null;
		}
		var store = Ext.StoreMgr.get(assoc.config.foreignStore);
		if (!store) {
			return null;
		}
		return store.findRecordAll(assoc.config.primaryKey, this.get(assoc.config.foreignKey));
	},

	getChildren: function(assocName) {
		var assoc = this.associations.get(assocName),
			id = this.get(assoc.config.primaryKey);

		if (!assoc) {
			return null;
		}
		var store = Ext.StoreMgr.get(assoc.config.foreignStore);
		if (!store) {
			return null;
		}

		return store.findRecordsAll(function(record) {
			return record.get(assoc.config.foreignKey) === id;
		});
	},

	getChildrenData: function(assocName){
		var records = this.getChildren(assocName);
		var rt = [];
		for(var i in records){
			rt.push(records[i].data);
		}
		return rt;
	},

	/* warning, recursive down in combination with up can be dangerous when there are loops in associations */
	getData: function(includeAssociated,down) {
		if (includeAssociated && !this.linkedAssociations) {
			this.linkedAssociations = true;
			this.linkAssociations(includeAssociated);
		}

		var data = this.callParent(arguments);

		if (down) {
			var childData = this.getAllChildData();
			Ext.apply(data, childData);
		}

		return data;
	},

	getRawData: function(strict) {
		var i, meta, data = Ext.apply({}, this.getData(false));
		if(!SalesForce.metaStore[this.self.getSfName()]) {
			return data;
		}
		meta = SalesForce.metaStore[this.self.getSfName()];
		for(i in data) {
			if(!meta.fieldMap[i] || (strict && !meta.fieldMap[i].createable)) {
				delete data[i];
			}
		}
		return data;
	},

	getFlattenedData: function(includeAssociated) {
		var data = this.getData(includeAssociated, false); // don't ever recurse down when getting flattened data!

		/* This function flattens the datastructure of am object such that it can be used in a form
		 * {foo:1,bar:{blah: {boo: 3}}} becomes {foo: 1, bar.blah.boo: 3}
		 * This is the only way to use associated data in a form
		 * thanks to http://stackoverflow.com/users/2214/matthew-crumley
		 */
		var count=1;
		var prop;
		var flatten = function(obj, includePrototype, into, prefix) {
			if (count++ > 20) {console.log('TOO DEEP RECURSION'); return;} // prevent infinite recursion
			into = into || {};
			prefix = prefix || "";

			for (var k in obj) {
				if (includePrototype || obj.hasOwnProperty(k)) {
					var prop = obj[k];
					if (prop instanceof Array) { continue; } // Don't recurse into hasMany relations
					if (prop && typeof prop === "object" &&
						!(prop instanceof Date || prop instanceof RegExp)) {
						flatten(prop, includePrototype, into, prefix + k + ".");
					}
					else {
						into[prefix + k] = prop;
					}
				}
			}

			return into;
		};

		return flatten(data, false);
	},

	/* this function ONLY recurses upwards (belongsTo), otherwise the data structure could become infinite */
	linkAssociations: function(includeAssociated, count) {
		var me = this,
			associations = this.associations.items,
			associationCount = associations.length,
			associationName,
			association,
			associatedRecord,
			i,
			type,
			foreignStore;

		count = count || 0;
		//debugger;
		if (count > 10) {
			console.log('Too deep recursion in linkAssociations');
			return;
		}

		for (i = 0; i < associationCount; i++) {
			association = associations[i];
			associationName = association.name; /* jtm: 09/17/2013 */
			type = association.type; /* jtm: 09/17/2013 */
			foreignStore = association.config.foreignStore;

			if (!foreignStore) {
				continue;
			}

			if (type.toLowerCase() === 'belongsto' || type.toLowerCase() === 'hasone') {
				associatedRecord = this.getParent(associationName);
				if (associatedRecord) {
					this[association.getInstanceName()] = associatedRecord;
					associatedRecord.linkAssociations(includeAssociated, (count+1));
				} else if (this.get(association.config.foreignKey)) {
					console.log('Warning, model association not found ');
				}
			}
		}
	},
	
	getAllChildData: function() {
		var associations = this.associations.items,
			associationCount = associations.length,
			associationName,
			association,
			i,
			type,
			foreignStore,
			childData = {};

		for (i = 0; i < associationCount; i++) {
			association = associations[i];
			associationName = association.getName();
			type = association.getType();
			foreignStore = association.config.foreignStore;
	
			if (!foreignStore) {
				continue;
			}
			
			if (type.toLowerCase() == 'hasmany') {
				var children = this.getChildrenData(associationName);
				childData[associationName] = children;
			}
		}
		
		return childData;
	},
	/**
	 * setFlattenedData(data) method to allow updating of baseModel using form data created using getFlattenedData approach (dot notation names)
	 *		or another baseModels getFlattenedData(true) output.
	 *		* Typical Usage: yourBaseModelInstance.setFlattenedData( form.getValues() )		
	 *
	 * @param {object} values - model field members and values to set
	 * @return {object} this.getFlattenedData(true) - (updated data set) or empty object if values param not an object
	 */
	setFlattenedData: function(values) { 
		var sFuncs=[],aName=[],dFuncs=[],
					i=0,j=0,
					name,sFnc,sDirty;
		if(typeof values != 'object'){
			return {};
		} else {
			this.setDirty();
			for (name in values) {
				if(typeof values[name] != 'object'){
					sFnc='this.';
					sDirty='this.';
					aName = name.split('.')
					while(aName.length > 1){
						sFnc=sFnc+'get'+aName[0]+'().';
						sDirty=sDirty+'get'+aName[0]+'().';
						dFuncs[j] = sDirty+'setDirty()';
						j++;
						aName.shift();
					}
					sFnc=sFnc+'set("'+aName[0]+'","'+values[name]+'")';
					sFuncs[i]=sFnc;
					i++;
				}
			}
			for(i=0;i<sFuncs.length;i++){
				eval(sFuncs[i]);
			}
			for(i=0;i<dFuncs.length;i++){
				eval(dFuncs[i]);
			}
			return this.getFlattenedData(true);
		}
	},
	// MC.data.Model methods
    getWriteData: function() {
        var data = this.getRecordWriteData(this),
            associations = this.associations.items,
            association, type, name, associatedStore, associatedRecords, associatedRecord,
            i, len, j, jLen, jDi
            phantom = this.phantom,
            writeAllFields = this.writeAllFields;
        for (i=0, len=associations.length; i<len; i++) {

            association = associations[i];
            type = association.type;
            name = association.name;
			// Use associationKey as a cue that the data is in-line (structured)
			if ( association.associationKey ) {

				if (type == 'hasMany') {

					associatedStore = this[association.storeName];

					if (associatedStore) {

						//Only write the association if it's an insert, it's specifically required or there are changes
						if (phantom || writeAllFields || associatedStore.getModifiedRecords().length > 0) {


							//if it's loaded, put it into the association data
							if (associatedStore.getCount() > 0) {
								//we will use this to contain each associated record's data
								data[name] = [];
								associatedRecords = associatedStore.data.items;

								//now we're finally iterating over the records in the association. Get
								// all the records so we can process them
								for (j=0, jDi = 0,jLen=associatedRecords.length; j<jLen; j++) {
									// Only write back dirty items
									if (associatedRecords[j].dirty){
										data[name][jDi] = this.getRecordWriteData(associatedRecords[j]);
										jDi++; // jtm - 11-05-2013
									}
								}
								// Get rid of if no records
								if(data[name].length == 0){
									delete data[name];
								}
							}
						}

					}

				} else if (type == 'hasOne') {
					associatedRecord = this[association.instanceName];
					// If we have a record and it has changed, put it onto our list
					if (associatedRecord !== undefined && associatedRecord.dirty ) {
						//data[name] = this.getRecordWriteData(associatedRecord);
						data[name] = associatedRecord.getWriteData();
					}
				}
			}
        }

        return data;
    },

    getRecordWriteData: function(record) {
        var isPhantom = record.phantom === true,
            writeAllFields = record.proxy.writer.writeAllFields || isPhantom,
            fields = record.fields,
            fieldItems = fields.items,
            data = {},
            changes,
            field,
            key,
            f, fLen,
            forcePersist;

        changes = record.getChanges();

        for (f=0, fLen=fieldItems.length; f<fLen; f++) {
            field = fieldItems[f];

            if (field.forcePersist || (field.persist && writeAllFields)) {
                this.setFieldWriteData(data, record, field);
            }
        }

        for (key in changes) {
            if (changes.hasOwnProperty(key)) {
                field = fields.get(key);
                if (field.persist) {
                    this.setFieldWriteData(data, record, field, changes[key]);
                }
            }
        }

        return data;
    },

    setFieldWriteData: function(data, record, field, value) {
        var name = field[this.nameProperty] || field.name,
            path, i, len, curr;

        if (!value) {
            value = record.get(field.name);
        }

        // Skip the id field for phantom records
        if (field.name === record.idProperty && record.phantom) {
            return;
        }

        if (field.mapping) {
            if (field.mapping.indexOf('.')) {
                path = field.mapping.split('.');
                curr = data;
                for (i=0, len=path.length-1; i<len; i++) {
                    if (!curr[path[i]]) {
                        curr[path[i]] = {};
                    }
                    curr = curr[path[i]];
                }
                curr[path[i]] = value;
            }
        } else {
            data[name] = value;
        }
    },
    /** 
     * Convenience method to set values to the model instance and save them via the proxy 
     *  
     * @param  {Object} values  An object of the properties to set. Same as for Model.set() 
     * @param  {Object} options The same options you can pass to Model.save()  
     * @return {Ext.bux.data.Model} The model instance 
     */ 
    saveValuesViaProxy : function(values,options){ 
                            // The save() triggers the PUT, no autoSync available on the model it appears 
                            // See http://edspencer.net/2011/02/02/proxies-extjs-4/ 
                            // options passed in can include a callback. Is Ext.data.Operation config 
                            // see http://docs.sencha.com/extjs/4.2.2/#!/api/Ext.data.Model-method-save 
        this.set(values); 
        return this.save(options);         
    } 
});