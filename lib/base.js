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

	function createSandbox() {

		function process(templateStr) {
			var _err;

			//try {

				var ret = global.grips.tokenizer.process(templateStr);
				//global.grips.parser.parseNextNode();

			//} catch (err) { _err = err; }

			if (true || ret) {
				//console.log(JSON.stringify(global.grips.tokenizer.dump(),true,"\t"));
				tmp = global.grips.tokenizer.dump();
				for (var i=0; i<tmp.length; i++) {
					console.log("token: " + tmp[i]);
				}

				console.log("");

				console.log(JSON.stringify(global.grips.parser.dump()));
			}

			if (_err) {
				console.log("");

				console.error(_err.toString());
			}
		}

		function noConflict() {
			var new_grips = global.grips;
			global.grips = old_grips;
			return new_grips;
		}

		var instance_api;

		instance_api = {
			processTemplate: process,

			noConflict: noConflict,
			sandbox: createSandbox
		};

		return instance_api;
	}

	global.grips = createSandbox();

})(this);