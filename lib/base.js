// non-ES5 polyfill for Object.create()
if (!Object.create) {
    Object.create = function(o) {
        function F(){}
        F.prototype = o;
        return new F();
    };
}

// circular-ref safe JSON.stringify() via Object.prototype.toJSON()
// https://gist.github.com/3373779
if (!Object.prototype.toJSON) {
	Object.prototype.toJSON = function() {
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

(function(global){
	var old_grips = global.grips;

	/* TemplateError */
	var TemplateError = (function() {
		function F(){}
		function CustomError(msg,ref) {
			// correct if not called with "new"
			var self = (this===window) ? new F() : this;
			self.message = msg;
			self.ref = ref;
			return self;
		}
		F.prototype = CustomError.prototype = Object.create(ReferenceError.prototype);
		CustomError.prototype.constructor = CustomError;

		CustomError.prototype.toString = function() {
			return "TemplateError: " + this.message + "; " + JSON.stringify(this.ref);
		};
		return CustomError;
	})();

	function createSandbox() {

		function compileTemplateFile(templateStr,filename) {
			var _err, ret, code;

			try {
				ret = global.grips.tokenizer.process(templateStr);
				global.grips.parser.endCurrentStream();

				/*tmp = global.grips.tokenizer.dump();
				for (var i=0; i<tmp.length; i++) {
					console.log("token: " + tmp[i]);
				}*/

				if (ret) {
					code = global.grips.generator.process();
				}

				//console.log(JSON.stringify(global.grips.parser.dump(),false,"\t"));
			} catch (err) { _err = err; }

			if (code) {
				console.log(code);
			}

			if (_err) {
				console.log("");

				console.error(_err.toString());
			}
		}

		function handleDefine(fn,filename,id,obj) {
			defines[id] = function(){};
		}

		function handleClone(obj) {
			if (obj == null) return obj;
			return JSON.parse(JSON.stringify(obj));
		}

		function handleErr(filename,obj,msg,errObj) {}

		function handleRender(id,$,_) {
			if (id in defines) {

			}
		}

		function noConflict() {
			var new_grips = global.grips;
			global.grips = old_grips;
			return new_grips;
		}

		var instance_api, defines = {};

		instance_api = {
			compileTemplate: compileTemplateFile,
			compileTemplateFile: compileTemplateFile,

			define: handleDefine,
			cloneObj: handleClone,
			err: handleErr,
			render: handleRender,

			noConflict: noConflict,
			sandbox: createSandbox,

			TemplateError: TemplateError,

			defines: defines
		};

		return instance_api;
	}

	global.grips = createSandbox();

})(this);