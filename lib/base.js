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

(function __grips_base__(global){
	var old_grips = global.grips;

	function createSandbox() {

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

		function noConflict() {
			var new_grips = global.grips;
			global.grips = old_grips;
			return new_grips;
		}

		function compile(sources) {
			var i, collection_id;

			if (Object.prototype.toString.call(sources) === "[object Array]") {
				for (i=0; i<sources.length; i++) {
					compileCollection(sources[i]);
				}
			}
			else if (typeof sources === "object") {
				for (collection_id in sources) { if (sources.hasOwnProperty(collection_id)) {
					compileCollection(sources[collection_id],collection_id);
				}}
			}
		}

		function compileCollection(source,collectionID) {
			var _err;

			try {
				if (_Grips.tokenizer.process(source,collectionID)) {
					_Grips.parser.end(); // end the collection stream
					_Grips.generator.process(/*build=*/true);
				}
			}
			catch (err) {
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
			}
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
					_err = error(collection_id,obj,"Unexpected error",err);
					_err.stack = err.stack; // try to preserve the original error call stack, if possible
					throw _err;
				}

				if (ret instanceof TemplateError) {
					throw ret;
				}
				else {
					return ret;
				}
			};
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

		function render(id,$,_) {
			var collection_id = id.match(/^(.*)#/);
			if (collection_id) {
				collection_id = collection_id[1];
			}

			if (!collection_id) {
				throw new TemplateError("Missing collection ID: " + id);
			}

			if (collection_id in collections) {
				if (id in collections[collection_id].partials) {
					return collections[collection_id].partials[id]($,_);
				}
				else {
					// check the extend chain
				}
			}

			throw new TemplateError("[" + id + "] Template not found");
		}



		var _Grips, collections = {};

		_Grips = {
			extend: extend,
			cloneObj: cloneObj,
			error: error,
			definePartial: definePartial,

			compile: compile,
			compileCollection: compileCollection,

			build: build,
			buildCollection: buildCollection,

			render: render,

			noConflict: noConflict,
			sandbox: createSandbox,

			TemplateError: TemplateError
		};

		return _Grips;
	}

	global.grips = createSandbox();

})(this);