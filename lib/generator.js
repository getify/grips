(function(global){

	// From: https://gist.github.com/3667624
	function escapeDoubleQuotes(str) {
		return str.replace(/\\([\s\S])|(")/g,"\\$1$2"); // thanks @slevithan!
	}

	function process() {
		function startFilemarker(node) {
			return "(function(G,_fname_){";
		}

		function closeFilemarker(node) {
			return "})(grips,\"" + node.close + "\");";
		}

		function tag_Extend(node) {
			return "G.extend(_fname_,\"" + node.id + "\");";
		}

		function conditional(node) {
			var i, _code = "", def;

			_code += expr(node.def[0]);
			_code += "?";
			_code += expr(node.def[1]);
			_code += ":";
			_code += expr(node.def[2]);

			return _code;
		}

		function expr(node) {
			var i, _code = "", def, prev_def;

			if (node.def[0].type === global.grips.parser.CONDITIONAL_EXPR) {
				_code += conditional(node.def[0]);
			}
			else {
				for (i=0; i<node.def.length; i++) {
					prev_def = def;
					def = node.def[i];
					if (def.type === global.grips.parser.TEXT) {
						if (!(
								def.val.match(/^(?:\$\$|_)(?:[^a-z0-9_$]|$)/i) ||
								(
									prev_def &&
									prev_def.type === global.grips.parser.OPERATOR &&
									prev_def.val === "."
								)
							)
						) {
							_code += "_.";
						}
						_code += def.val;
					}
					else if (def.type === global.grips.parser.OPERATOR) {
						_code += def.val;
					}
					else if (def.type === global.grips.parser.STRING_LITERAL) {
						_code += def.delimiter + def.val + def.delimiter;
					}
				}
			}

			return _code;
		}

		function assignmentSetLiteral(node) {
			var i, _code = "", def;

			return _code;
		}

		function assignment(node) {
			var i, _code = "", def;

			if (node.def[node.def.length-1].type === global.grips.parser.SET_LITERAL) {
				_code += assignmentSetLiteral(node);
			}
			else {
				_code += expr(node.def[0]);
				_code += "=";
				_code += expr(node.def[1]);
			}

			return _code;
		}

		function tag_Define(node) {
			var i, _code = "", def;

			_code += "G.define(\"" + node.id.val + "\",function($$){";
			_code += "$$ = G.clone($$);";
			_code += "var _ = {}, i, ret = \"\";";

			for (i=1; i<node.def.length; i++) {
				def = node.def[i];
				_code += "try {";
				_code += assignment(def);
				_code += "} catch (err" + i + ") {";
				_code += "G.err(_fname_,\"" + node.id.val + "\",\"" + escapeDoubleQuotes(def.toString()) + "\",err" + i + ");";
				_code += "}";
			}

			_code += "});";
			return _code;
		}


		var node, nodes = [], code = "";

		while ((node = global.grips.parser.parseNextNode())) {
			nodes.push(node);

			if (node.type === global.grips.parser.FILEMARKER) {
				if (node.start) {
					code += startFilemarker(node);
				}
				else if (node.close) {
					code += closeFilemarker(node);
				}
			}
			else if (node.type === global.grips.parser.TAG_EXTEND) {
				if (!(
						nodes.length > 1 &&
						nodes[nodes.length - 2].type === global.grips.parser.FILEMARKER
					)
				) {
					throw new global.grips.parser.ParserError("Unexpected Tag",node);
				}
				code += tag_Extend(node);
			}
			else if (node.type === global.grips.parser.TAG_DEFINE) {
				code += tag_Define(node);
			}
		}

		return code;
	}

	var instance_api;

	instance_api = {
		process: process
	};

	global.grips.generator = instance_api;

})(this);