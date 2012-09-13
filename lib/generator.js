(function(global){

	// From: https://gist.github.com/3667624
	function escapeDoubleQuotes(str) {
		return str.replace(/\\([\s\S])|(")/g,"\\$1$2"); // thanks @slevithan!
	}

	function escapeNewlines(str) {
		return str.replace(/\n/g,"\\n").replace(/\r/g,"\\r");
	}

	function escapeEscapes(str) {
		return str.replace(/\\(?!\\*\")/g,"\\\\");
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

	function conditional(node) {
		return expr(node.def[0]) + " ? " + expr(node.def[1]) + " : " + expr(node.def[2]);
	}

	function string_literal(node) {
		return node.delimiter + node.val + node.delimiter;
	}

	function range_literal(node) {
		var code = "";

		code += "for (i=" + node.def[0] + "; i";
		if (node.def[0] <= node.def[1]) {
			code += "<=" + node.def[1] + "; i++) { ";
		}
		else {
			code += ">=" + node.def[1] + "; i--) { ";
		}

		return code;
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

		if (node.type === global.grips.parser.STRING_LITERAL ||
			node.type === global.grips.parser.ID
		) {
			code += string_literal(node);
		}
		else if (node.def && node.def.length > 0) {
			if (node.def[0].type === global.grips.parser.CONDITIONAL_EXPR) {
				code += conditional(node.def[0]);
			}
			else {
				for (i=0; i<node.def.length; i++) {
					prev_def = def;
					def = node.def[i];
					if (def.type === global.grips.parser.TEXT) {
						if (!(
								def.val.match(/^\d+$/) ||
								def.val.match(/^(?:\$\$?)(?=(?:[^a-z0-9_$]|$))/i) ||
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
		}
		else {
			throw new global.grips.parser.ParserError("Invalid EXPR",node);
		}

		return code;
	}

	function assignmentRangeLiteral(node) {
		var code = "", def, tmp;

		def = node.def[0];
		tmp = expr(def.def[0]);

		code += tmp + " = {}; ";
		code += range_literal(def.def[1]);

		def = node.def[1].def[0];

		code += tmp + "[i] = (" + expr(def.def[0]) + " === i) ? ";
		code += expr(def.def[1]) + " : " + expr(def.def[2]) + "; ";
		code += "} ";

		return code;
	}

	function assignmentSetLiteral(node) {
		var code = "", def, tmp;

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
		if (def.def[def.def.length-1].type === global.grips.parser.RANGE_LITERAL) {
			code += assignmentRangeLiteral(node);
		}
		else if (def.def[def.def.length-1].type === global.grips.parser.SET_LITERAL) {
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

	function tagExtend(node) {
		return "G.extend(_fname_,\"" + node.id + "\"); ";
	}

	function tagDefine(node) {
		var i, code = "", def;

		code += "G.define(function __" + identifierify(node.id.val.replace(/^.*#/,"")) + "__($,_){ ";
		code += "$ = G.cloneObj($) || {}; ";
		code += "_ = G.cloneObj(_) || {}; ";
		code += "var i, ret = \"\", ret2; ";

		for (i=1; i<node.def.length; i++) {
			def = node.def[i];
			code += "try { ";
			code += assignment(def);
			code += "} catch (err" + i + ") { ";
			code += "return G.err(_fname_," + simpleNodeJSON(def) + ",\"Assignment failed.\",err" + i + "); ";
			code += "} ";
		}

		code += children(node);
		code += "},_fname_,\"" + node.id.val + "\"," + simpleNodeJSON(node) + "); ";
		return code;
	}

	function tagLoop(node) {
		var i, code = "", def, tmp;

		code += "ret2 = (function __loop__($,_,$$){ ";
		code += "function __iter__($,_,value,key,index){ ";
		code += "var i, ret = \"\", ret2, $$; ";
		code += "if (value == null) return ret; ";
		code += "$ = G.cloneObj($); ";
		code += "_ = G.cloneObj(_); ";
		code += "$$ = { ";
		code += "value: value, ";
		code += "key: key, ";
		code += "index: index, ";
		code += "even: (index % 2) === 0, ";
		code += "odd: (index % 2) === 1, ";
		code += "}; ";
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
		code += "try { ";

		if (node.main_expr.def[0].type === global.grips.parser.SET_LITERAL) {
			code += set_literal(node.main_expr.def[0]);
			code += "ret2 = __iter__($,_,_set[i],i); ";
			code += templateErrorGuard("ret","ret2");
			code += "} ";
		}
		else if (node.main_expr.def[0].type === global.grips.parser.RANGE_LITERAL) {
			code += range_literal(node.main_expr.def[0]);
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
			code += "}} ";
			code += "} else { ";
			code += "return G.err(_fname_," + simpleNodeJSON(node.main_expr) + ",\"Invalid loop-iterator reference.\"); ";
			code += "} ";
		}

		code += "} catch (err) { ";
		code += "return G.err(_fname_," + simpleNodeJSON(node.main_expr) + ",\"Failed loop iteration.\",err); ";
		code += "} ";
		code += "})(G.cloneObj($),G.cloneObj(_),G.cloneObj($$)); ";
		code += templateErrorGuard("ret","ret2");

		return code;
	}

	function tagIncludeTemplate(node) {
		var code = "", tmp;

		tmp = expr(node.context_expr);

		if (tmp === "$") {
			code += "ret2 = $; ";
		}
		else {
			code += "try { ";
			code += "ret2 = " + expr(node.context_expr) + "; ";
			code += "} catch (err) { ";
			code += "return G.err(_fname_," + simpleNodeJSON(node.context_expr) + ",\"Include template context reference failed.\",err); ";
			code += "} ";
		}
		code += "try { ";
		code += "ret2 = G.render(" + expr(node.main_expr) + ",ret2,_); ";
		code += "} catch (err) { ";
		code += "return G.err(_fname_," + simpleNodeJSON(node.main_expr) + ",\"Include template reference failed.\",err); ";
		code += "} ";
		code += templateErrorGuard("ret","ret2");

		return code;
	}

	function tagIncludeVar(node) {
		var code = "";

		code += "try { ";
		code += "ret += " + expr(node.main_expr) + "; ";
		code += "} catch (err) { ";
		code += "return G.err(_fname_," + simpleNodeJSON(node.main_expr) + ",\"Include reference failed.\",err); ";
		code += "} ";

		return code;
	}

	function children(node) {
		var i, code = "", child;

		for (i=0; i<node.children.length; i++) {
			child = node.children[i];
			if (child.type === global.grips.parser.TEXT) {
				code += "ret += \"" + escapeNewlines(escapeEscapes(escapeDoubleQuotes(child.val))) + "\"; ";
			}
			else if (child.type === global.grips.parser.TAG_LOOP) {
				code += tagLoop(child);
			}
			else if (child.type === global.grips.parser.TAG_INCL_TMPL) {
				code += tagIncludeTemplate(child);
			}
			else if (child.type === global.grips.parser.TAG_INCL_VAR) {
				code += tagIncludeVar(child);
			}
		}

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
				code += tagExtend(node);
			}
			else if (node.type === global.grips.parser.TAG_DEFINE) {
				code += tagDefine(node);
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