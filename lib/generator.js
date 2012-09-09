(function(global){

	// From: https://gist.github.com/3667624
	function escapeDoubleQuotes(str) {
		return str.replace(/\\([\s\S])|(")/g,"\\$1$2"); // thanks @slevithan!
	}

	function simpleNodeJSON(node) {
		var ret;

		ret = {
			type: node.type,
			pos: null,
			val: node.toString()
		};
		if (node.token) {
			ret.pos = node.token.pos;
		}

		return JSON.stringify(ret);
	}

	function identifierify(str) {
		str = str.replace(/[^a-z0-9_$]/ig,"_");
		if (!str || str.match(/^\d/)) str = "_" + str;
		return str;
	}

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
		return expr(node.def[0]) + " ? " + expr(node.def[1]) + " : " + expr(node.def[2]);
	}

	function string_literal(node) {
		return node.delimiter + node.val + node.delimiter;
	}

	function set_literal(node) {
		var i, code = "", def, tmp;

		tmp = "";
		for (i=0; i<node.def.length; i++) {
			def = node.def[i];
			tmp += (tmp !== "" ? "," : "") + string_literal(def);
		}
		code += "var _set = [" + tmp + "]; ";
		code += "for (i=0; i<" + node.def.length + "; i++) { ";

		return code;
	}

	function expr(node) {
		var i, code = "", def, prev_def;

		if (node.type === global.grips.parser.STRING_LITERAL) {
			code += string_literal(node);
		}
		else if (node.def[0].type === global.grips.parser.CONDITIONAL_EXPR) {
			code += conditional(node.def[0]);
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
						code += "_.";
					}
					code += def.val;
				}
				else if (def.type === global.grips.parser.OPERATOR) {
					code += def.val;
				}
				else if (def.type === global.grips.parser.STRING_LITERAL) {
					code += string_literal(def);
				}
			}
		}

		return code;
	}

	function assignmentSetLiteral(node) {
		var i, code = "", def, def2, tmp, nodes;

		def = node.def[0];
		tmp = expr(def.def[0]);

		code += tmp + " = {}; ";
		code += set_literal(def.def[1]);

		def = node.def[1].def[0];

		code += tmp + "[_set[i]] = (" + expr(def.def[0]) + " === _set[i]) ? ";
		code += expr(def.def[1]) + " : " + expr(def.def[2]) + "; ";
		code += "} ";

		return code;
	}

	function assignment(node) {
		var code = "", def;

		def = node.def[0];
		if (def.def[def.def.length-1].type === global.grips.parser.SET_LITERAL) {
			code += assignmentSetLiteral(node);
		}
		else {
			code += expr(def);
			code += " = ";
			code += expr(node.def[1]);
			code += "; ";
		}

		return code;
	}

	function tag_Define(node) {
		var i, code = "", def;

		code += "G.define(function __define_" + identifierify(node.id.val.replace(/^.*#/,"")) + "__($){ ";
		code += "$ = G.clone($); ";
		code += "var i, _ = {}, ret = \"\", ret2; ";

		for (i=1; i<node.def.length; i++) {
			def = node.def[i];
			code += "try { ";
			code += assignment(def);
			code += "} catch (err" + i + ") { ";
			code += "return G.err(_fname_," + simpleNodeJSON(def) + ",\"Assignment failed.\",err" + i + "); ";
			code += "} ";
		}

		code += children(node);
		code += "},_fname_," + simpleNodeJSON(node) + "); ";
		return code;
	}

	function tag_Loop(node) {
		var i, code = "", def, tmp;

		code += "ret2 = (function __loop__($,_){ ";
		code += "function __iter__($,_,$$,key,index){ ";
		code += "var ret = \"\", ret2; ";
		code += "$ = G.clone($); ";
		code += "_ = G.clone(_); ";
		code += "$$ = { ";
		code += "val: $$, ";
		code += "key: key, ";
		code += "index: index, ";
		code += "even: (index % 2) === 0, ";
		code += "odd: (index % 2) === 1, ";
		code += "};"
		code += "if ($$ == null) return ret; ";
		for (i=1; i<node.def.length; i++) {
			def = node.def[i];
			code += "try { ";
			code += assignment(def);
			code += "} catch (err" + i + ") { ";
			code += "return G.err(_fname_," + simpleNodeJSON(def) + ",\"Assignment failed in loop iteration: \" + JSON.stringify($$,[\"key\",\"index\"]),err" + i + ");";
			code += "} ";
		}
		code += children(node);
		code += "return ret; ";
		code += "} ";
		code += "var i, j = 0, ret = \"\"; ";
		code += "$ = G.clone($); ";
		code += "_ = G.clone(_); ";
		code += "try { ";

		if (node.main_expr.def[0].type === global.grips.parser.SET_LITERAL) {
			code += set_literal(node.main_expr);
			code += "ret2 = __iter__($,_,_set[i],i); ";
			code += templateErrorGuard("ret","ret2");
			code += "} ";
		}
		else if (node.main_expr.def[0].type === global.grips.parser.RANGE_LITERAL) {
			def = node.main_expr.def[0];
			if (def.def[0] <= def.def[1]) {
				code += "for (i=" + def.def[0] + "; i<=" + def.def[1] + "; i++) { ";
			}
			else {
				code += "for (i=" + def.def[0] + "; i>=" + def.def[1] + "; i--) { ";
			}
			code += "ret2 = __iter($,_,i,i); ";
			code += templateErrorGuard("ret","ret2");
			code += "} ";
		}
		else {
			tmp = expr(node.main_expr);
			code += "if (Object.prototype.toString.call(" + tmp + ") === \"[object Array]\") { ";
			code += "for (i=0; i<" + tmp + ".length; i++) { ";
			code += "ret2 = __iter__($,_," + tmp + "[i],i,i); ";
			code += templateErrorGuard("ret","ret2");
			code += "} ";
			code += "} else if (typeof " + tmp + " === \"object\") { ";
			code += "for (i in " + tmp + ") { if (" + tmp + ".hasOwnProperty(i)) { ";
			code += "ret2 = __iter__($,_," + tmp + "[i],i,j++); ";
			code += templateErrorGuard("ret","ret2");
			code += "}} else { ";
			code += "return G.err(_fname_," + simpleNodeJSON(node.main_expr) + ",\"Invalid loop-iterator reference.\"); ";
			code += "} ";
		}

		code += "} catch (err) { ";
		code += "return G.err(_fname_," + simpleNodeJSON(node.main_expr) + ",\"Failed loop iteration.\",err); ";
		code += "} ";
		code += "})(G.clone($),G.clone(_)); ";
		code += templateErrorGuard("ret","ret2");

		return code;
	}

	function children(node) {
		var i, code = "", def;

		return code;
	}

	function templateErrorGuard(collector,test) {
		var code = "";

		code += "if (" + test + " instanceof G.TemplateError) { ";
		code += "return " + test + "; ";
		code += "} else { ";
		code += collector + " += " + test + "; ";
		code += "} ";

		return code;
	}

	function process() {
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