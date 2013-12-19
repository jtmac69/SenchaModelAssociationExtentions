## Sencha ExtJS Model Association Extentions ##

This repo contains Extentions to the Sencha ExtJS Model  (Ext.data.Model), JsonReader (Ext.data.reader.Json) and JsonWriter (Ext.data.writer.Json) definitions.

The versions here work with ExtJS 4.2.2, correct some bugs, add additional model 'save' features and combine the very helpful extensions created by ModusCreateOrg's Aaron Smith 


- Blog:  Expert Ext JS: Reading and Writing Structured Data [http://moduscreate.com/expert-ext-js-reading-and-writing-structured-data/](http://moduscreate.com/expert-ext-js-reading-and-writing-structured-data/ "Expert Ext JS: Reading and Writing Structured Data")
- GitHub: [https://github.com/ModusCreateOrg/modus-create-sencha-plugin-pack/tree/master/MC/data](https://github.com/ModusCreateOrg/modus-create-sencha-plugin-pack/tree/master/MC/data)

and Appoint Solution's Rob Boerman 


- Blog: Model Associations in Sencha Touch (and ExtJS) made easy!
The BaristaStuff Inc. case [http://appointsolutions.com/2013/07/model-associations-in-sencha-touch-and-extjs-made-easythe-baristastuff-inc-case/](http://appointsolutions.com/2013/07/model-associations-in-sencha-touch-and-extjs-made-easythe-baristastuff-inc-case/ "Model Associations in Sencha Touch (and ExtJS) made easy!")
- GitHub: [https://github.com/robboerman/SenchaAssociationsPart1/tree/master/app/model](https://github.com/robboerman/SenchaAssociationsPart1/tree/master/app/model)


### Changes: ###

- Works with ExtSJ 4.2.2
- a **setFlattenedData()** method to take flattened data references (from the getValues() method of a form which uses flattened data references) and place them back into the model hierarchy properly.
- Ensure that if a parent is not dirty but it's *child* is, mark the parent dirty to ensure proper post/put payload contains all dirty fields.
- Bug fix: If a hasMany association has not records that are dirty, prevent the payload JSON from containing that sub-object. 

To use, 

1. The default name-space used in the components is MC.data.  So you either have to change this to whatever Sencha MVC location you wish to place the items for your project OR create a sub directories in your project of MC/data.
2. Within your ExtJS app, add the path for 'MC' to your Ext.Loader.setConfig (e.g., *'MC' : 'MC'*)
3. In your model definitions, extend MC.data.BaseModel (rather than Ext.data.Model)
4. *Optionally*, specifiy the proxy JsonReader or JsonWriter objects (to make use of that functionality).
4. Include whatever of these object definitions you will be using in your ExtJS application **requires** config. (*requires: ['MC.data.BaseModel','MC.data.JsonWriter'
]*).



