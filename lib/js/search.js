/** @license Search.js 0.0.1
 *  (c) 2013 Hiroki Osame
 *  Search.js may be freely distributed under the MIT license.
 */

;var VisualSearch = (function($, _){

	//Autocomplete - Category Add-On
	$.widget("ui.autocomplete", $.ui.autocomplete, {
		_renderMenu: function( ul, items ) {
			var that = this,
			currentCategory = "";
			$.each( items, function( index, item ) {
				if( item.category && item.category != currentCategory ) {
					ul.append( "<li class='ui-autocomplete-category'>" + item.category + "</li>" );
					currentCategory = item.category;
				}

				//To differentiate categories
				var dom = that._renderItemData(ul, item);
				if(item.category && item.category == currentCategory){
					dom.children().addClass("category-child");
				}
			});
		}
	});

	//jQuery - Get Caret Position
	$.fn.getCursorPosition = function() {
		var position = 0;
		var input    = this.get(0);

		if (document.selection) { // IE
			input.focus();
			var sel		= document.selection.createRange();
			var selLen	= document.selection.createRange().text.length;
			sel.moveStart('character', -input.value.length);
			position	= sel.text.length - selLen;
		} else if (input && $(input).is(':visible') && input.selectionStart != null) { // Firefox/Safari
			position = input.selectionStart;
		}

		return position;
	}

	//Underscore - Transpose Objects
	_.transpose = function(array) {
		var keys = _.union.apply(_, _.map(array, _.keys)),
		result = {};
		for (var i=0, l=keys.length; i<l; i++) {
			var key = keys[i];
			result[key] = _.pluck(array, key);
		}
		return result;
	};


	/* Main View */
	var VS = Backbone.View.extend({

		events : {
			'mousedown .VS-search-box'		: 'clickBox',
			'click .VS-cancel-search-box'	: 'clearSearch',
			'focus input'					: 'unselect',
			'keydown input'					: 'inputkeydown',
			'dblclick .VS-search-box'		: 'highlightSearch',
		},

		initialize : function(options){
			var self = this;

			//Default Parameters
			this.options =	_.extend({
				el	: '',
				defaultquery: [],
				placeholder	: "Enter your search query here...",
				strict: true,	//Only accept parameters that are defined
				search: $.noop,
				parameters: [],
				defaultquery: []
			}, options);


			//Create the Search Query -- A collection of current parameters
			this.searchQuery	= new VS.SearchQuery(this.options.defaultquery, {
				parameters: this.options.parameters,
				strict: this.options.strict
			})
			.on({
				"add remove change:editing": function(m){
					if(m.collection){
						self.options.search(JSON.stringify(m.collection.getComplete(), function(k, v){
							if(
								!k || k==="0" || parseInt(k) ||
								k === "key" || k === "operator" || k === "value"
							) return v;
							return undefined;
						}));
					}
				},
				"all": function(e, m){
					self.render();
				},
				"change:value": function(model){
					var index = self.searchQuery.indexOf(model);
					self.newParam({}, index+1);
				}
			});

			this.bindKeys();
			this.render();

			$(document).on({
				click: function(e){
					if(
						!$(e.target).closest(".VS-search").length ||	//If Not in Visual Search Box
						!e.shiftKey	//If Shift is not held 
					){
						self.searchQuery.invoke('set', {'selected': false});
					}
				},
				keydown: _.bind(this.keydown, self),
				keyup: _.bind(this.bindKeys, self)
			});

			//Dynamic Input
			this.$el.on("keypress keyup keydown", "input", function(e){
				var container = self.$(".VS-search-inner"),
					containerwidth = container.width()-parseInt(container.css('margin-left')),
					input = $(this),
					shadow = $("<span>").css({
								position: 'absolute',
								top: -9999,
								left: -9999,
								width: 'auto',
								fontSize: input.css('fontSize'),
								fontFamily: input.css('fontFamily'),
								fontWeight: input.css('fontWeight'),
								letterSpacing: input.css('letterSpacing'),
								"text-transform": input.css('text-transform'),
								whiteSpace: 'nowrap'
							}).text($(this).val()).insertAfter(this),
					newWidth = shadow.width()+20;

				if( input.width() < newWidth && newWidth < containerwidth){
					input.css("width", newWidth);
				}
				shadow.remove();
			});
		},

		render : function(){
			var self			= this,
				template		= $(VS.template['search_box'](this.options)),
				placeholder		= $('.VS-placeholder', template);
				this.parameterViews = [];

			if (this.searchQuery.length) {
				placeholder.hide();

				$('.VS-search-inner', template).append(this.searchQuery.map(function(parameter){
					var parameterView = new VS.ParameterView({
						model : parameter
					}).render().el;

					self.parameterViews.push(parameterView);
					return parameterView;
				}));

			} else {
				placeholder.show();
			}

			this.$el.html(template);

			return this;
		},

		clickBox: function(e, index){
			if(	!$(e.target).is('.VS-search-box, .VS-search-inner, .VS-placeholder') ) return;

			var self = this;

			for( var i in this.parameterViews ){
				var parameterView = $(this.parameterViews[i]);

				//If the row the cursor is on is done iterating, stop loop.
				if( parameterView.offset().top > e.pageY ) break;

				//If row is above the row clicked on, continue
				if( parameterView.offset().top+parameterView.height() < e.pageY ) continue;

				if( e.pageX < parameterView.offset().left ){
					return _.delay(function(){ self.newParam({}, i); });
				}
			}
			i = ( i == this.parameterViews.length-1 ) ? this.parameterViews.length : i;

			_.delay(function(){ self.newParam({}, i); });
		},
		newParam: function(parameter, index){
			var paremeter = new VS.Parameter(parameter);
			this.searchQuery.add(paremeter, {at: index || null});
		},
		unselect: function(e){
			this.searchQuery.invoke('set', {'selected': false});
		},
		clearSearch : function(e){
			this.searchQuery.reset();
		},
		highlightSearch: function(e){
			if(!$(e.target).is("input, .search_parameter")) return;
			this.searchQuery.invoke('set', {'selected': true});
		},
		inputkeydown: function(e){
			var self = this,
				editNext = function(){
					var selected = self.searchQuery.getEditing()[0],
						editing = selected.get('editing');

					if( editing===2 ){
						var index = self.searchQuery.indexOf(selected);
						selected.set("editing", false);
						self.newParam({}, index+1);
					}else
					if(editing===false){
						var index = self.searchQuery.indexOf(selected);
						selected.destroy();
						var select = self.searchQuery.at(index);
						if(select){
							select.set("editing", 0);
						}
					}else
					{
						selected.set("editing", editing+1);
					}
				},
				editPrevious = function(){
					var selected = self.searchQuery.getEditing()[0],
						editing = selected.get('editing');

					//If editing, make a new parameter before
					if( editing===0 ){
						var index = self.searchQuery.indexOf(selected);
						selected.set("editing", false);
						self.newParam({}, index);
					}else

					//If New Parameter
					if( editing===false ){
						var index = self.searchQuery.indexOf(selected);
						selected.destroy();
						if( self.searchQuery.at(index-1) ){	self.searchQuery.at(index-1).set("editing", 2);	}
					}else
					{
						selected.set("editing", editing-1);
					}
				},
				keys = {
					//Left
					37: function(){
						if( $(e.target).getCursorPosition()==0 ){ editPrevious(); }
					},

					//Right
					39: function(){
						var input = $(e.target);
						if( input.getCursorPosition()==input.val().length ){ editNext(); }
					},

					//Delete
					8: function(){
						var input = $(e.target);
						if( input.getCursorPosition()===0 &&
							input.get(0).selectionStart === input.get(0).selectionEnd //Only Webkit, no IE
						){ editPrevious(); return false; }
					},

					//Tab
					9: function(){
						if( e.shiftKey ){
							e.preventDefault();
							editPrevious();
						}else{
							e.preventDefault();
							editNext();
						}
					},

					//Enter
					13: function(){
						$(e.target).blur();
					}
				};

			return (keys[e.keyCode]) ? keys[e.keyCode]() : null;
		},
		keydown: function(e){
			//Check if Parameters are selected
			if( !e || $(".VS-search .selected").length===0 ){ return; }
			if( [8, 37, 38, 39, 40].indexOf(e.keyCode)!=-1 ){ return false; }
		},
		bindKeys: function(e){
			//Check if Parameters are selected
			if( !e || $(".VS-search .selected").length===0 ){ return; }

			var self = this,
				keys = {
					//Delete
					8: function(){
						var selected = self.searchQuery.where({'selected': true});
						selected.forEach(function(e){
							e.destroy();
						});
					},

					//Enter - Start Editing
					13: function(){
						var selected = self.searchQuery.where({'selected': true});
						selected[0].set("editing", 0);
					},

					//Right 39
					39: function(){
						var selected = self.searchQuery.where({'selected': true}),
							index = self.searchQuery.indexOf(_.last(selected)),
							moveTo = self.searchQuery.at(index+1);

						self.unselect();
						if(moveTo){
							moveTo.set("selected", true);
						}else{
							var paremeter = new VS.Parameter();
							self.searchQuery.add(paremeter, {at: index+1});
						}
					},

					//Left 37
					37: function(){
						var selected = self.searchQuery.where({'selected': true}),
							index = self.searchQuery.indexOf(_.first(selected)),
							moveTo = self.searchQuery.at(index-1);

						self.unselect();
						if(index === -1){
							self.searchQuery.at(self.searchQuery.length-1).set("selected", true);
						}else if(moveTo){
							moveTo.set("selected", true);
						}else{
							var paremeter = new VS.Parameter();
							self.searchQuery.add(paremeter, {at: 0});
						}
					},

					//Up 38
					38: function(){
						self.unselect();
						_.first(self.searchQuery.models).set("selected", true);
					},

					//Down 40
					40: function(){
						self.unselect();
						_.last(self.searchQuery.models).set("selected", true);
					}
				};
			return (keys[e.keyCode]) ? keys[e.keyCode]() : null;

			/*
			//Cntrl+A - Select All
			self.searchQuery.invoke('set', {'selected': true});
			return false;
			*/
		}
	});


	/* Templates */
	VS.template = 
	{
		'search_box': _.template('<div class="VS-search">\n  <div class="VS-search-box-wrapper VS-search-box">\n    <div class="VS-icon VS-icon-search"></div>\n    <div class="VS-placeholder"><%= placeholder %></div>\n    <div class="VS-search-inner"></div>\n    <div class="VS-icon VS-icon-cancel VS-cancel-search-box" title="clear search"></div>\n  </div>\n</div>'),
		'search_parameter': _.template('<div class="search_parameter_remove VS-icon VS-icon-cancel"></div><div class="key"><%- model.get(\'key\') %></div><div class="operator"><%- model.get(\'operator\') %></div><div class="value"><%- model.get(\'value\') %></div>')
	};


	/* Parameter View */
	VS.ParameterView = Backbone.View.extend({

		className : 'search_parameter',
		
		events : {
			'focus input'	: 'inputFocused',
			'blur input'	: 'inputBlurred',
			'click'			: 'click',
			'click div.VS-icon-cancel': 'delete',
			'keydown input'				: 'keydown',
		},

		render : function() {
			var self = this,
				parameters = this.model.collection.parameters;
				template = $(VS.template['search_parameter']({model: this.model}));

			this.$el.html(template);
			this.key = {
				dom: $("<input/>").attr({
					autocomplete:	"off",
					type:			"text",
					name:			"key",
					value: this.model.get('key')
				}),
				autocomplete: {
					minLength : 0,
					delay     : 0,
					source: parameters.category,
					select: function( e, ui ) {
						this.value = ui.item.value;
						$(this).blur();
					}
				}
			};
			this.operator = {
				dom: $("<input/>").attr({
					autocomplete:	"off",
					name:			"operator",
					placeholder: "==",
					value: 	this.model.get("operator"),
					size: "2"
				}),
				autocomplete: {
					minLength : 0,
					delay     : 0,
					source: function(req, res){
						var key 	= self.model.get('key'),
							i = parameters.key.indexOf(key);
						if(parameters.operators[i]){
							res(parameters.operators[i]);
						}else{
							res(["==", "!=", "<", ">", "≤", "≥"]);
						}
					},
					select: function( e, ui ) {
						this.value = ui.item.value;
						$(this).blur();
					}
				}
			};
			this.value = {
				dom: $("<input/>").attr({
					autocomplete:	"off",
					name:			"value",
					value: 			this.model.get("value"),
					placeholder:	this.model.get("placeholder"),
					type:			this.model.get("type"),
					min:			this.model.get("min"),
					max:			this.model.get("max"),
					maxlength:		this.model.get("maxlength"),
					size:			this.model.has("value") ? this.model.get("value").length : 10,
				}),
				autocomplete: {
					minLength : 0,
					delay     : 0,
					source: function(req, res){
						var key 	= self.model.get('key'),
							i = parameters.key.indexOf(key);
						res(parameters.values[i]);
					},
					select: function( e, ui ) {
						this.value = ui.item.value;
						$(this).blur();
					}
				}
			};

			if( !this.model.has('key') || this.model.get('editing')===0 ){
				this.autocomplete(
					this.$("div.key").html(this.key.dom).children(),
					this.key.autocomplete
				).focus(0);
			}else{
				if( !this.model.has('operator') || this.model.get('editing')===1 ){
					this.autocomplete(
						this.$("div.operator").html(this.operator.dom).children(),
						this.operator.autocomplete
					).focus(0);
				}else{
					if( !this.model.has('value') || this.model.get('editing')===2 ){
						this.autocomplete(
							this.$("div.value").html(this.value.dom).children(),
							this.value.autocomplete
						).focus(0);
					}else{
						//All fields must be completed in order to be selected
						if( this.model.get('selected') ){
							this.$el.addClass("selected");
						}
					}
				}
			}
			return this;
		},
		inputFocused: function(e){
			$(e.target).autocomplete("search", "");
		},
		inputBlurred: function(e){
			var input = $(e.target),
				editing = this.model.get('editing');

			var update;
			(update = {
				'editing': ( editing<2 ) ? editing+1 : null
			})[input.attr("name")] =  input.val();

			/*
			//Value didn't change and isn't operator
			if(
				this.model.get(input.attr("name"))==input.val() &&
				editing!=1
			){
				update['editing'] = null;
			}
			*/
			this.model.set(update);
		},
		click: function(e){
			if( e.target.localName=="input" ) return;

			var clicked = this.model.clicked;

			clearTimeout(clicked.timeout);
			clicked.timeout = setTimeout(function(){
				clicked.count = 0;
			}, 300);
			
			if(clicked.count>0){
				this.dblclick(e);
			}else{
				//Single Click
				var self = this;
				_.delay(function(){
					self.model.set('selected', true);
				});
			}
			clicked.count++;
		},
		dblclick: function(e){
			var target = $(e.target);
			if( target.is("div.key") ){
				this.model.set("editing", 0);
			}else if( target.is("div.operator") ){
				this.model.set("editing", 1);
			}else if( target.is("div.value") ){
				this.model.set("editing", 2);
			}
		},
		delete: function(){
			this.model.destroy();
		},
		autocomplete: function(target, options){
			target.autocomplete(options).autocomplete('widget').addClass('VS-interface');
			return target;
		},
		keydown : function(e) {


		}
	});


	/* Parameter Model */
	VS.Parameter = Backbone.Model.extend({

		//Default Parameters
		defaults: {
			key: null,			//Name of Parameter
			value: null,		//Value of Parameter
			placeholder: "",	//Value of Placeholder
			type: "text",		//Text, Number, Date, etc.
			operator: null,		//=, !=, ≤, ≥
			maxlength: null,

			//Optional Parameter for Number/Date
			max: null,
			min: null,

			selected: false,
			editing: false
		},
		initialize: function(model){
			this.setType();

			//Bind Events
			this.on({
				"change:key change:operator change:value": function(model, changedVal){

					//Delete if Blank
					if(!changedVal){ return model.destroy(); }

					//If "key" was changed
					if(model.hasChanged("key")){
						model.setType();
					}
				}
			});
		},
		incomplete: function(){
			return !(this.has('key') && this.has('operator') && this.has('value'));
		},
		clicked: {
			count: 0,
			timeout: null
		},
		setType: function(){
			var key = this.get('key');
			if(!key) return;
			var collection = this.collection,
				i = collection.parameters.key.indexOf(key);

			//Kill if the parameter doesn't exist?
			if(collection.strict && i === -1 ){
				return this.destroy();
			}else

			//If exists
			if(i!==-1){
				this.set({
					"type": collection.parameters.type[i],
					"placeholder": collection.parameters.placeholder[i],
					"min": collection.parameters.min[i],
					"max": collection.parameters.max[i]
				});
			}
		}
	});


	/* Collection of Parameters */
	VS.SearchQuery = Backbone.Collection.extend({
		model : VS.Parameter,
		initialize: function(models, options){
			_.extend(this, options);

			//Transpose
			this.parameters = _.transpose(this.parameters);

			//Organize Labels into Categories
			for( var i in this.parameters.key){
				this.parameters.category[i] = { label: this.parameters.key[i], category: this.parameters.category[i]}
			}
		},
		getEditing: function(){
			return _.filter(this.models, function(model){
				return $.isNumeric(model.get('editing')) || model.incomplete();
			});
		},
		getComplete: function(){
			return _.filter(this.models, function(model){
				return !model.incomplete();
			});		
		}
	});

	return VS;
})(jQuery, _);
