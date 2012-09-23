/* grips (c) 2012 Kyle Simpson | http://getify.mit-license.org/ */

// non-ES5 polyfill for Object.keys()
if (!Object.keys) {
	Object.keys = function __Object_keys__(obj) {
		var i, r = [];
		for (i in obj) { if (obj.hasOwnProperty(i)) {
			r.push(i);
		}}
		return r;
	};
}

/* START_DEBUG */
// non-ES5 polyfill for Object.create()
if (!Object.create) {
    Object.create = function __Object_create__(o) {
        function F(){}
        F.prototype = o;
        return new F();
    };
}

// circular-ref safe JSON.stringify() via Object.prototype.toJSON()
// https://gist.github.com/3373779
if (!Object.prototype.toJSON) {
	Object.prototype.toJSON = function __Object_toJSON__() {
		function findCircularRef(obj) {
			for (var i=0; i<refs.length; i++) {
				if (refs[i] === obj) return true;
			}
			return false;
		}

		function traverse(obj) {
			function element(el) {
				if (typeof el === "object") {
					if (el !== null) {
						if (Date === el.constructor || Number === el.constructor || Boolean === el.constructor || String === el.constructor || RegExp === el.constructor) {
							return el;
						}
						else if (!findCircularRef(el)) {
							return traverse(el);
						}
					}
					return null;
				}
				return el;
			}

			var idx, tmp, tmp2;

			if (Object.prototype.toString.call(obj) === "[object Array]") {
				refs.push(obj);
				tmp = [];
				for (idx=0; idx<obj.length; idx++) {
					tmp.push(element(obj[idx]));
				}
				refs.pop();
				return tmp;
			}
			else if (typeof obj === "object") {
				if (obj !== null) {
					if (Date === obj.constructor || Number === obj.constructor || String === obj.constructor || Boolean === obj.constructor || RegExp === obj.constructor) {
						return obj;
					}
					else if (!findCircularRef(obj)) {
						refs.push(obj);
						tmp = {};
						for (idx in obj) { if (obj.hasOwnProperty(idx)) {
							tmp2 = element(obj[idx]);
							if (tmp2 !== null) tmp[idx] = tmp2;
						}}
						refs.pop();
						return tmp;
					}
				}
				return null;
			}
			else return obj;
		}

		var refs = [], ret;
		ret = traverse(this);
		refs = [];
		return ret;
	};

	// ES5-only: prevent this `toJSON()` from showing up in for-in loops
	if (Object.defineProperty) {
		Object.defineProperty(Object.prototype,"toJSON",{enumerable:false});
	}
}
/* STOP_DEBUG */

(function __grips_base__(global){
	var old_grips = global.grips;

	function createSandbox() {

/* START_DEBUG */
		/* TemplateError */
		var TemplateError = (function TemplateError() {
			function F(){}
			function CustomError(msg,ref,stack) {
				// correct if not called with "new"
				var self = (this===global) ? new F() : this;
				self.message = msg;
				self.ref = ref;
				return self;
			}
			F.prototype = CustomError.prototype = Object.create(ReferenceError.prototype);
			CustomError.prototype.constructor = CustomError;

			CustomError.prototype.toString = function __TemplateError_toString__() {
				var ret = "TemplateError: " + this.message;
				if (this.ref) {
					ret += "; " + JSON.stringify(this.ref);
				}
				if (this.stack) {
					ret += "\n" + this.stack;
				}
				return ret;
			};
			return CustomError;
		})();
/* STOP_DEBUG */

		function RangeLiteralHash() {} // work-around for Chrome object iteration quirks

		function noConflict() {
			var new_grips = global.grips;
			global.grips = old_grips;
			return new_grips;
		}

		function initCollectionRecord(collectionID) {
			if (!(collectionID in collections)) {
				collections[collectionID] = {
					collection: "",
					extend: null,
					partials: {}
				};
			}
		}

		function extend(collectionID,id) {
			initCollectionRecord(collectionID);
			collections[collectionID].extend = id;
		}

		function cloneObj(obj) {
			var i, ret, ret2;
			if (typeof obj === "object") {
				if (obj === null) return obj;
				if (Object.prototype.toString.call(obj) === "[object Array]") {
					ret = [];
					for (i = 0; i < obj.length; i++) {
						if (typeof obj[i] === "object") {
							ret2 = deepClone2(obj[i]);
						}
						else {
							ret2 = obj[i];
						}
						ret.push(ret2);
					}
				}
				else {
					if (obj instanceof RangeLiteralHash) {
						ret = new RangeLiteralHash();
					}
					else {
						ret = {};
					}
					for (i in obj) {
						if (obj.hasOwnProperty(i)) {
							if (typeof(obj[i] === "object")) {
								ret2 = cloneObj(obj[i]);
							}
							else {
								ret2 = obj[i];
							}
							ret[i] = ret2;
						}
					}
				}
			}
			else {
				ret = obj;
			}
			return ret;
		}

/* START_DEBUG */
		function error(collectionID,obj,msg,errObj) {
			msg = "[" + collectionID + "] " + msg;
			if (errObj) {
				msg += "; " + errObj.toString();
			}
			return new TemplateError(msg,obj,(errObj ? errObj.stack : null));
		}
/* STOP_DEBUG */

		function definePartial(fn,id,obj) {
			var collection_id = id.match(/^(.*)#/);
			if (collection_id) {
				collection_id = collection_id[1];
			}

			if (!collection_id) {
				throw /* START_DEBUG */new TemplateError("Missing collection ID: " + id) ||/* STOP_DEBUG */unknown_error;
			}

			initCollectionRecord(collection_id);

			collections[collection_id].partials[id] = function __handle_partial__(){
				var _err, ret;

				try {
					ret = fn.apply(_Grips,arguments);
				}
				catch (err) {
/* START_DEBUG */
					_err = error(collection_id,obj,"Unexpected error",err);
					_err.stack = err.stack; // try to preserve the original error call stack, if possible
					throw _err;
/* STOP_DEBUG */
					throw unknown_error;
				}

				if (ret instanceof Error) {
					throw ret;
				}
				else {
					return ret;
				}
			};
		}

/* START_COMPILER */
		function compile(sources,initialize) {
			var ret = "", i, collection_id;

			// default `initialize` to `true`
			initialize = (initialize !== false);

			if (Object.prototype.toString.call(sources) === "[object Array]") {
				for (i=0; i<sources.length; i++) {
					ret += compileCollection(sources[i],null,initialize);
				}
			}
			else if (typeof sources === "object") {
				for (collection_id in sources) { if (sources.hasOwnProperty(collection_id)) {
					ret += compileCollection(sources[collection_id],collection_id,initialize);
				}}
			}

			return ret;
		}

		function compileChunk(source,collectionID) {
			if (!collectionID) {
				throw /* START_DEBUG */new TemplateError("Missing collection ID") ||/* STOP_DEBUG */unknown_error;
			}
			return compileCollection(source,collectionID,/*initialize=*/false);
		}

		function compileCollection(source,collectionID,initialize) {
			var _err;

			// default `initialize` to `true`
			initialize = (initialize !== false);

			try {
				if (_Grips.tokenizer.process(source,collectionID)) {
					_Grips.parser.end(); // end the collection stream
					return _Grips.generator.process(initialize);
				}
			}
			catch (err) {
/* START_DEBUG */
				if (err instanceof _Grips.tokenizer.TokenizerError ||
					err instanceof _Grips.parser.ParserError
				) {
					throw err;
				}
				else {
					_err = error(collectionID,null,"Unexpected compilation error",err);
					_err.stack = err.stack; // try to preserve the original error call stack, if possible
					throw _err;
				}
/* STOP_DEBUG */
				throw unknown_error;
			}
			return false;
		}

		function initialize(source) {
			var script, script0;
			if ("document" in global) {
				script = document.createElement("script");
				script.text = source;
				script0 = document.getElementsByTagName("script")[0];
				script0.parentNode.insertBefore(script,script0);
			}
			else {
				script = new Function(source);
				script.call(global);
			}
		}

		function initializeCollection(collectionID,source) {
			initCollectionRecord(collectionID);
			initialize(source);
		}
/* STOP_COMPILER */

		function render(id,$,_) {
			var collection_id = id.match(/^(.*)#/);
			if (collection_id) {
				collection_id = collection_id[1];
			}

			if (!collection_id) {
				throw /* START_DEBUG */new TemplateError("Missing collection ID: " + id) ||/* STOP_DEBUG */unknown_error;
			}

			if (collection_id in collections) {
				if (id in collections[collection_id].partials) {
					return collections[collection_id].partials[id]($,_);
				}
				else if (collections[collection_id].extend) {
					return render(id.replace(/^.+?#/,collections[collection_id].extend + "#"),$,_);
				}
			}

			throw /* START_DEBUG */new TemplateError("[" + id + "] Template not found") ||/* STOP_DEBUG */unknown_error;
		}


		var _Grips, collections = {},
			unknown_error = new Error("Unknown error")
		;

		_Grips = {
			extend: extend,
			cloneObj: cloneObj,
			/* START_DEBUG */error: error,/* STOP_DEBUG */
			definePartial: definePartial,

/* START_COMPILER */
			compile: compile,
			compileChunk: compileChunk,
			compileCollection: compileCollection,

			initialize: initialize,
			initializeCollection: initializeCollection,
/* STOP_COMPILER */

			render: render,

			/* START_DEBUG */TemplateError: TemplateError,/* STOP_DEBUG */

			noConflict: noConflict,
			sandbox: createSandbox,

			RangeLiteralHash: RangeLiteralHash
		};

		return _Grips;
	}

	global.grips = createSandbox();

})(this);
