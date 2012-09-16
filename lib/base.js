// non-ES5 polyfill for Object.create()
if (!Object.create) {
    Object.create = function __Object_create__(o) {
        function F(){}
        F.prototype = o;
        return new F();
    };
}

/* START_DEBUG */
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
				var self = (this===window) ? new F() : this;
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

		function noConflict() {
			var new_grips = global.grips;
			global.grips = old_grips;
			return new_grips;
		}

		function extend(collectionID,id) {
			collections[collectionID].extend = id;
		}

		function cloneObj(obj) {
			if (obj == null) return obj;
			return JSON.parse(JSON.stringify(obj));
		}

		function error(collectionID,obj,msg,errObj) {
			msg = "[" + collectionID + "] " + msg;
			if (errObj) {
				msg += "; " + errObj.toString();
			}
			return new TemplateError(msg,obj,(errObj ? errObj.stack : null));
		}

		function definePartial(fn,id,obj) {
			var collection_id = id.match(/^(.*)#/);
			if (collection_id) {
				collection_id = collection_id[1];
			}

			if (!collection_id) {
				throw new TemplateError("Missing collection ID: " + id);
			}

			if (!(collection_id in collections)) {
				collections[collection_id] = {
					collection: "",
					extend: null,
					partials: {}
				};
			}

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

				if (ret instanceof TemplateError) {
					throw ret;
				}
				else {
					return ret;
				}
			};
		}

/* START_COMPILER */
		function compile(sources,build) {
			var ret = "", i, collection_id;

			// default `build` to `true`
			build = (build !== false);

			if (Object.prototype.toString.call(sources) === "[object Array]") {
				for (i=0; i<sources.length; i++) {
					ret += compileCollection(sources[i],null,build);
				}
			}
			else if (typeof sources === "object") {
				for (collection_id in sources) { if (sources.hasOwnProperty(collection_id)) {
					ret += compileCollection(sources[collection_id],collection_id,build);
				}}
			}

			return ret;
		}

		function compileChunk(source,collectionID) {
			if (!collectionID) {
				throw /* START_DEBUG */new TemplateError("Missing collection ID") ||/* STOP_DEBUG */unknown_error;
			}
			return compileCollection(source,collectionID,/*build=*/false);
		}

		function compileCollection(source,collectionID,build) {
			var _err;

			// default `build` to `true`
			build = (build !== false);

			try {
				if (_Grips.tokenizer.process(source,collectionID)) {
					_Grips.parser.end(); // end the collection stream
					return _Grips.generator.process(build);
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

		function build(source) {
			var script, script0;
			if (document) {
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

		function buildCollection(collectionID,source) {
			collections[collectionID] = {
				collection: source,
				extend: null,
				partials: {}
			};

			build(source);
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
				else {
					// check the extend chain
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
			error: error,
			definePartial: definePartial,

/* START_COMPILER */
			compile: compile,
			compileChunk: compileChunk,
			compileCollection: compileCollection,

			build: build,
			buildCollection: buildCollection,
/* STOP_COMPILER */

			render: render,

			/* START_DEBUG */TemplateError: TemplateError,/* STOP_DEBUG */

			noConflict: noConflict,
			sandbox: createSandbox
		};

		return _Grips;
	}

	global.grips = createSandbox();

})(this);
