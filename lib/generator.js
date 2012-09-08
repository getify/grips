(function(global){

	// From: https://gist.github.com/3667624
	function escapeDoubleQuotes(str) {
		return str.replace(/\\([\s\S])|(")/g,"\\$1$2"); // thanks @slevithan!
	}

	function simpleNodeJSON(node) {
		var ret;

		ret = {
			type: node.type,
			token: null,
			val: node.toString()
		};
		if (node.token) {
			ret.token = node.token;
		}

		return JSON.stringify(ret);
	}

	function identifierify(str) {
		str = str.replace(/[^a-z0-9_$]/ig,"_");
		if (!str || str.match(/^\d/)) str = "_" + str;
		return str;
	}

	function process() {
		function startFilemarker(node) {
			return "(function __" + identifierify(node.start) + "__(G,_fname_){ ";
		}

		function closeFilemarker(node) {
			return "})(this.grips,\"" + node.close + "\"); ";
		}

		function tag_Extend(node) {
			return "G.extend(_fname_,\"" + node.id + "\"); ";
		}

		function conditional(node) {
			var i, _code = "", def;

			_code += expr(node.def[0]);
			_code += " ? ";
			_code += expr(node.def[1]);
			_code += " : ";
			_code += expr(node.def[2]);

			return _code;
		}

		function string_literal(node) {
			return node.delimiter + node.val + node.delimiter;
		}

		function set_literal(node) {
			var i, _code = "", def, tmp;

			tmp = "";
			for (i=0; i<node.def.length; i++) {
				def = node.def[i];
				tmp += (tmp !== "" ? "," : "") + string_literal(def);
			}
			_code += "var _set = [" + tmp + "]; ";
			_code += "for (i=0; i<" + node.def.length + "; i++) { ";

			return _code;
		}

		function expr(node) {
			var i, _code = "", def, prev_def;

			if (node.type === global.grips.parser.STRING_LITERAL) {
				_code += string_literal(node);
			}
			else if (node.def[0].type === global.grips.parser.CONDITIONAL_EXPR) {
				_code += conditional(node.def[0]);
			}
			else {
				for (i=0; i<node.def.length; i++) {
					prev_def = def;
					def = node.def[i];
					if (def.type === global.grips.parser.TEXT) {
						if (!(
								def.val.match(/^(?:\$\$?)(?![^a-z0-9_$])/i) ||
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
						_code += string_literal(def);
					}
				}
			}

			return _code;
		}

		function assignmentSetLiteral(node) {
			var i, _code = "", def, def2, tmp, nodes;

			def = node.def[0];
			tmp = expr(def.def[0]);

			_code += tmp + " = {}; ";
			_code += set_literal(def.def[1]);

			def = node.def[1].def[0];

			_code += tmp + "[_set[i]] = (" + expr(def.def[0]) + " === _set[i]) ? ";
			_code += expr(def.def[1]) + " : ";
			_code += expr(def.def[2]) + "; ";
			_code += "} ";

			return _code;
		}

		function assignment(node) {
			var _code = "", def;

			def = node.def[0];
			if (def.def[def.def.length-1].type === global.grips.parser.SET_LITERAL) {
				_code += assignmentSetLiteral(node);
			}
			else {
				_code += expr(def);
				_code += " = ";
				_code += expr(node.def[1]);
				_code += "; ";
			}

			return _code;
		}

		function tag_Define(node) {
			var i, _code = "", def;

			_code += "G.define(function __define_" + identifierify(node.id.val.replace(/^.*#/,"")) + "__($){ ";
			_code += "$ = G.clone($); ";
			_code += "var i, _ = {}, ret = \"\"; ";

			for (i=1; i<node.def.length; i++) {
				def = node.def[i];
				_code += "try { ";
				_code += assignment(def);
				_code += " } catch (err" + i + ") { ";
				_code += "G.err(_fname_," + simpleNodeJSON(def) + ",\"Assignment failed.\",err" + i + ");";
				_code += " }";
			}

			_code += children(node);
			_code += "},_fname_," + simpleNodeJSON(node) + "); ";
			return _code;
		}

		function tag_Loop(node) {
			var i, _code = "", def, tmp;

			_code += "(function __loop__($,_){ ";
			_code += "function __iter__($,_,$$,i){ ";
			_code += "var ret = \"\"; ";
			_code += "$ = G.clone($); ";
			_code += "_ = G.clone(_); ";
			_code += "$$ = G.objectify($$); ";
			_code += "if ($$ == null) return ret; ";
			for (i=1; i<node.def.length; i++) {
				def = node.def[i];
				_code += "try { ";
				_code += assignment(def);
				_code += " } catch (err" + i + ") { ";
				_code += "G.err(_fname_," + simpleNodeJSON(def) + ",\"Assignment failed.\",err" + i + ");";
				_code += " }";
			}
			_code += children(node);
			_code += "return ret; ";
			_code += "} ";
			_code += "var i, j = 0, ret = \"\"; ";
			_code += "$ = G.clone($); ";
			_code += "_ = G.clone(_); ";

			if (node.main_expr.def[0].type === global.grips.parser.SET_LITERAL) {
				_code += set_literal(node.main_expr);
				_code += "ret += __iter__($,_,_set[i],i); ";
				_code += "} ";
			}
			else if (node.main_expr.def[0].type === global.grips.parser.RANGE_LITERAL) {
				def = node.main_expr.def[0];
				if (def.def[0] <= def.def[1]) {
					_code += "for (i=" + def.def[0] + "; i<=" + def.def[1] + "; i++) { ";
				}
				else {
					_code += "for (i=" + def.def[0] + "; i>=" + def.def[1] + "; i--) { ";
				}
				_code += "ret += __iter($,_,i,i); ";
				_code += "} ";
			}
			else {
				tmp = expr(node.main_expr);
				_code += "if (Object.prototype.toString.call(" + tmp + ") === \"[object Array]\") { ";
				_code += "for (i=0; i<" + tmp + ".length; i++) { ";
				_code += "ret += __iter__($,_," + tmp + "[i],i); ";
				_code += "} ";
				_code += "} else if (typeof " + tmp + " === \"object\") { ";
				_code += "for (i in " + tmp + ") { ";
				_code += "ret += __iter__($,_," + tmp + "[i],j++); ";
				_code += "} else { ";
				_code += "G.err(_fname_," + simpleNodeJSON(node.main_expr) + ",\"Invalid loop-iterator reference.\"); ";
				_code += "} ";
			}
			_code += "} catch (err) { ";
			_code += "G.err(_fname_," + simpleNodeJSON() + ",\"\",err); ";
			_code += "} ";
			_code += "})(G.clone($),G.clone(_)); ";
		}

		function children(node) {
			var i, ret = "", def;

			return ret;
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