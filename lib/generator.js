/* grips (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/ */

/* START_COMPILER */
(function __grips_generator__(global,_Grips){

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

/* START_DEBUG */
	function simpleNodeJSON(node) {
		var ret;

		ret = {
			type: node.type,
			pos: null,
			val: node.toString()
		};
		if (node.type === _Grips.parser.ID &&
			node.token &&
			node.token.val
		) {
			ret.val = node.token.val;
		}
		if (node.token) {
			ret.pos = {
				line: node.token.pos.line,
				col: node.token.pos.col
			};
		}

		return JSON.stringify(ret);
	}

	function identifierify(str) {
		str = str.replace(/[^a-z0-9_$]/ig,"_");
		return str;
	}
/* STOP_DEBUG */

	function collectionDependencies() {
		var code = "";
		if (needs.sort)	code += "function __sort_fn__(a,b){ return a-b; }";
		code += "var partial = G.definePartial, clone = G.cloneObj";
/* START_DEBUG */
		code += ", error = G.error";
/* STOP_DEBUG */
		if (needs.extend) code += ", extend = G.extend";
		if (needs.esc) code += ", esc = G.strEscapes";
		if (needs.unerr) code += ", unerr = new Error(\"Unknown error\")";
		if (needs.RLH) code += ", RLH = G.RangeLiteralHash";
		if (needs.cID) code += ", cID = \"" + needs.cID_value + "\"";
		code += ";";

		return code;
	}

	function startCollection(node) {
		var code = "";
		code += "(function" /* START_DEBUG */+ " __" + identifierify(node.start) + "__"/* STOP_DEBUG */ + "(G){";
			code += "/*startCollection*/";	// NOTE: this will get replaced later by whatever the dependencies are for this collection
		return code;
	}

	function closeCollection() {
		return "})(this.grips||grips);";
	}

	function conditional(node) {
		return expr(node.def[0]) + " ? " + expr(node.def[1]) + " : " + expr(node.def[2]);
	}

	function string_literal(node) {
		return node.delimiter + node.val + node.delimiter;
	}

	function range_literal(node) {
		var code = "";

		code += "for (i=" + node.def[0].val + "; i";
		if (node.def[0].val <= node.def[1].val) {
			code += "<=" + node.def[1].val + "; i++) {";
		}
		else {
			code += ">=" + node.def[1].val + "; i--) {";
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
		code += "var _set = [" + tmp + "];";
		code += "for (i=0; i<" + node.def.length + "; i++) {";

		return code;
	}

	function expr(node) {
		var i, code = "", def, prev_def;

		if (node.type === _Grips.parser.STRING_LITERAL ||
			node.type === _Grips.parser.ID
		) {
			code += string_literal(node);
		}
		else if (node.def && node.def.length > 0) {
			if (node.def[0].type === _Grips.parser.CONDITIONAL_EXPR) {
				code += conditional(node.def[0]);
			}
			else {
				for (i=0; i<node.def.length; i++) {
					prev_def = def;
					def = node.def[i];
					if (def.type === _Grips.parser.TEXT) {
						if (!(
								def.val.match(/^\d+$/) ||
								def.val.match(/^[_\$](?=(?:[^a-z0-9_$]|$))/i) ||
								(
									prev_def &&
									prev_def.type === _Grips.parser.OPERATOR &&
									prev_def.val === "."
								)
							)
						) {
							code += "$$.";
						}
						code += def.val;
					}
					else if (def.type === _Grips.parser.OPERATOR) {
						code += def.val;
					}
					else if (def.type === _Grips.parser.STRING_LITERAL) {
						code += string_literal(def);
					}
				}
			}
		}
		else {
			throw /* START_DEBUG */new _Grips.parser.ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */ unknown_error;
		}

		return code;
	}

	function assignmentRangeLiteral(node) {
		var code = "", def, tmp;

		def = node.def[0];
		tmp = expr(def.def[0]);

		code += tmp + " = new RLH();";
		code += range_literal(def.def[1]);

		def = node.def[1].def[0];

		code += tmp + "[\"\" + i] = (" + expr(def.def[0]) + " === i) ? ";
		code += expr(def.def[1]) + " : " + expr(def.def[2]) + ";";
		code += "}";

		needs.RLH = true;	// update collection dependencies list

		return code;
	}

	function assignmentSetLiteral(node) {
		var code = "", def, tmp;

		def = node.def[0];
		tmp = expr(def.def[0]);

		code += tmp + " = {};";
		code += set_literal(def.def[1]);

		def = node.def[1].def[0];

		code += tmp + "[_set[i]] = (" + expr(def.def[0]) + " === _set[i]) ? ";
		code += expr(def.def[1]) + " : " + expr(def.def[2]) + ";";
		code += "}";

		return code;
	}

	function assignment(node) {
		var code = "", def;

		def = node.def[0];
		if (def.def[def.def.length-1].type === _Grips.parser.RANGE_LITERAL) {
			code += assignmentRangeLiteral(node);
		}
		else if (def.def[def.def.length-1].type === _Grips.parser.SET_LITERAL) {
			code += assignmentSetLiteral(node);
		}
		else {
			code += expr(def);
			code += " =";
			code += expr(node.def[1]);
			code += ";";
		}

		return code;
	}

	function tagExtend(node) {
		needs.extend = true;	// update collection dependencies list
		needs.cID = true;	// update collection dependencies list

		return "extend(cID,\"" + node.id.val + "\");";
	}

	function tagDefine(node) {
		var i, code = "", def;

		code += "partial(function" /* START_DEBUG */+ " __" + identifierify(node.id.val.replace(/^.*#/,"")) + "__"/* STOP_DEBUG */ + "($,$$){";
		code += "$$ = clone($$) || {};";
		code += "var i, ret = \"\", ret2, _;";

		for (i=1; i<node.def.length; i++) {
			def = node.def[i];
/* START_DEBUG */
			code += "try {";
/* STOP_DEBUG */
			code += assignment(def);
/* START_DEBUG */
			code += "} catch (err" + i + ") {";
			code += "return error(cID," + simpleNodeJSON(def) + ",\"Assignment failed\",err" + i + ");";
			code += "}";
			needs.cID = true;	// update collection dependencies list
/* STOP_DEBUG */
		}

		code += children(node);
		code += "return ret;";
		code += "},\"" + node.id.val + "\"";
/* START_DEBUG */
		code += "," + simpleNodeJSON(node);
/* STOP_DEBUG */
		code += ");";
		return code;
	}

	function tagEscape(node) {
		var code = "";

		code += "ret2 = esc((function" /* START_DEBUG */+ " __escape__ "/* STOP_DEBUG */ + "(){";
		code += "var ret = \"\", ret2;";
		code += children(node);
		code += "return ret;";
		code += "})()," + JSON.stringify(node.escapes) + ");";
		code += templateErrorGuard("ret","ret2");

		needs.esc = true;	// update collection dependencies list
		return code;
	}

	function tagLoop(node) {
		var i, code = "", def;

		code += "ret2 = (function" /* START_DEBUG */+ " __loop__ "/* STOP_DEBUG */ + "(){";
		code += "function __iter__($,$$,value,key,index){";
			code += "var i, ret = \"\", ret2, _;";
			code += "if (value == null) return ret;";
			code += "$$ = clone($$);";
			code += "_ = {";
				code += "value: value,";
				code += "key: key,";
				code += "index: index,";
				code += "even: (index % 2) === 0,";
				code += "odd: (index % 2) === 1,";
				code += "first: (index === 0),";
				code += "last: (index === len - 1)";
			code += "};";
		for (i=1; i<node.def.length; i++) {
			def = node.def[i];
/* START_DEBUG */
			code += "try {";
/* STOP_DEBUG */
			code += assignment(def);
/* START_DEBUG */
			code += "} catch (err" + i + ") {";
			code += "return error(cID," + simpleNodeJSON(def) + ",\"Assignment failed in loop iteration: \" + JSON.stringify(_,[\"key\",\"index\"]),err" + i + ");";
			code += "}";
			needs.cID = true;	// update collection dependencies list
/* STOP_DEBUG */
		}
		code += children(node);
		code += "return ret;";
		code += "}";
		code += "var i, j = 0, len, ret = \"\", it, tmp;";
/* START_DEBUG */
		code += "try {";
/* STOP_DEBUG */

		if (node.main_expr.def[0].type === _Grips.parser.SET_LITERAL) {
			code += set_literal(node.main_expr.def[0]);
			code += "len = _set.length;";
			code += "ret2 = __iter__($,$$,_set[i],\"\"+i,i);";
			code += templateErrorGuard("ret","ret2");
			code += "}";
		}
		else if (node.main_expr.def[0].type === _Grips.parser.RANGE_LITERAL) {
			code += "len = " + (Math.abs(node.main_expr.def[0].def[0].val - node.main_expr.def[0].def[1].val) + 1) + ";";
			code += range_literal(node.main_expr.def[0]);
			code += "ret2 = __iter__($,$$,i,\"\"+i,j++);";
			code += templateErrorGuard("ret","ret2");
			code += "}";
		}
		else {
			code += "it = " + expr(node.main_expr) + ";";
			code += "if (it == null) {";
				code += "return \"\";";
			code += "}";
			code += "if (Array.isArray(it)) {";
				code += "len = it.length;";
				code += "for (i=0; i<len; i++) {";
					code += "ret2 = __iter__($,$$,it[i],\"\"+i,i);";
					code += templateErrorGuard("ret","ret2");
				code += "}";
			code += "} else if (typeof it === \"object\") {";
				code += "tmp = Object.keys(it);";
				code += "len = tmp.length;";
				code += "if (it instanceof RLH) {"; // are we iterating over a previously declared RangeLiteralHash?
					code += "tmp.sort(__sort_fn__);"; // work around Chrome-V8's buggy iteration order for "numeric" keys: http://code.google.com/p/v8/issues/detail?id=164
				code += "}";
				code += "for (i=0; i<len; i++) {";
					code += "ret2 = __iter__($,$$,it[tmp[i]],tmp[i],i);";
					code += templateErrorGuard("ret","ret2");
				code += "}";
			code += "} else {";
				code += "return ";
/* START_DEBUG */
				code += "error(cID," + simpleNodeJSON(node.main_expr) + ",\"Invalid loop-iterator reference\") || ";
				needs.cID = true;	// update collection dependencies list
/* STOP_DEBUG */
				code += "unerr;";
			code += "}";

			needs.sort = true;	// update collection dependencies list
			needs.RLH = true;	// update collection dependencies list
			needs.unerr = true;	// update collection dependencies list
		}

/* START_DEBUG */
		code += "} catch (err) {";
			code += "return error(cID," + simpleNodeJSON(node.main_expr) + ",\"Failed loop iteration\",err);";
		code += "}";
		needs.cID = true;	// update collection dependencies list
/* STOP_DEBUG */
		code += "return ret;";
		code += "})();";
		code += templateErrorGuard("ret","ret2");
		return code;
	}

	function tagLet(node) {
		var i, code = "", def;

		code += "ret2 = (function" /* START_DEBUG */+ " __let__ "/* STOP_DEBUG */ + "($,$$){";
		code += "$$ = clone($$) || {};";
		code += "var i, ret = \"\", ret2, _;";

		for (i=0; i<node.def.length; i++) {
			def = node.def[i];
/* START_DEBUG */
			code += "try {";
/* STOP_DEBUG */
			code += assignment(def);
/* START_DEBUG */
			code += "} catch (err" + i + ") {";
			code += "return error(cID," + simpleNodeJSON(def) + ",\"Assignment failed\",err" + i + ");";
			code += "}";
			needs.cID = true;	// update collection dependencies list
/* STOP_DEBUG */
		}

		code += children(node);

		code += "return ret;";
		code += "})($,$$);";
		code += templateErrorGuard("ret","ret2");

		return code;
	}

	function tagIncludeTemplate(node) {
		var code = "", tmp;

		tmp = expr(node.context_expr);

/* START_DEBUG */
		code += "try {";
/* STOP_DEBUG */
			code += "ret2 = " + tmp + ";";
/* START_DEBUG */
		code += "} catch (err) {";
			code += "return error(cID," + simpleNodeJSON(node.context_expr) + ",\"Include template context reference failed\",err);";
		code += "}";
		needs.cID = true;	// update collection dependencies list
/* STOP_DEBUG */

/* START_DEBUG */
		code += "try {";
/* STOP_DEBUG */
			code += "ret2 = G.render(" + expr(node.main_expr) + ",ret2,$$);";
/* START_DEBUG */
		tmp = simpleNodeJSON(node.main_expr);
		code += "} catch (err) {";
			code += "if (err instanceof G.TemplateError) {";
				code += "err.ref = " + tmp + ";";
				code += "return err;";
			code += "} else {";
				code += "return error(cID," + tmp + ",\"Include template reference failed\",err);";
			code += "}";
		code += "}";
		needs.cID = true;	// update collection dependencies list
/* STOP_DEBUG */
		if (node.escapes) {
			code += "ret2 = esc(ret2," + JSON.stringify(node.escapes) + ");";
			needs.esc = true;	// update collection dependencies list
		}
		code += templateErrorGuard("ret","ret2");

		return code;
	}

	function tagInsertVar(node) {
		var code = "", tmp = expr(node.main_expr);

/* START_DEBUG */
		code += "try {";
/* STOP_DEBUG */
		if (node.escapes) {
			code += "ret += esc(" + tmp + "," + JSON.stringify(node.escapes) + ");";
			needs.esc = true;	// update collection dependencies list
		}
		else {
			code += "ret += " + tmp + ";";
		}
/* START_DEBUG */
		code += "} catch (err) {";
			code += "return error(cID," + simpleNodeJSON(node.main_expr) + ",\"Insert reference failed\",err);";
		code += "}";
		needs.cID = true;	// update collection dependencies list
/* STOP_DEBUG */

		return code;
	}

	function children(node) {
		var i, code = "", child;

		for (i=0; i<node.children.length; i++) {
			child = node.children[i];
			if (child.type === _Grips.parser.TEXT) {
				code += "ret += \"" + escapeNewlines(escapeEscapes(escapeDoubleQuotes(child.val))) + "\";";
			}
			else if (child.type === _Grips.parser.TAG_LOOP) {
				code += tagLoop(child);
			}
			else if (child.type === _Grips.parser.TAG_LET) {
				code += tagLet(child);
			}
			else if (child.type === _Grips.parser.TAG_INCL_TMPL) {
				code += tagIncludeTemplate(child);
			}
			else if (child.type === _Grips.parser.TAG_INSERT_VAR) {
				code += tagInsertVar(child);
			}
			else if (child.type === _Grips.parser.TAG_ESCAPE) {
				code += tagEscape(child);
			}
		}

		return code;
	}

	function templateErrorGuard(collector,test) {
		var code = "";

/* START_DEBUG */
		code += "if (" + test + " instanceof G.TemplateError) {";
			code += "return " + test + ";";
		code += "} else {";
/* STOP_DEBUG */
			code += collector + " += " + test + ";";
/* START_DEBUG */
		code += "}";
/* STOP_DEBUG */

		return code;
	}

	function process(initialize) {
		var node, nodes = [], collection = "", code = "", tmp, tmp2;

		while ((node = _Grips.parser.parseNextNode())) {
			nodes.push(node);

			if (node.type === _Grips.parser.COLLECTION_MARKER) {
				if (node.start) {
					needs = {};
					tmp = startCollection(node);
					needs.cID_value = node.start;
					collection += tmp;
					code += tmp;
				}
				else if (node.close) {
					tmp2 = collectionDependencies(needs);
					tmp = closeCollection(node);
					collection += tmp;
					collection = collection.replace(/\/\*startCollection\*\//,tmp2);
					code += tmp;
					code = code.replace(/\/\*startCollection\*\//,tmp2);
					if (initialize) {
						_Grips.initializeCollection(node.close,collection);
					}
					collection = "";
				}
			}
			else if (node.type === _Grips.parser.TAG_EXTEND) {
				if (!(
						nodes.length > 1 &&
						nodes[nodes.length - 2].type === _Grips.parser.COLLECTION_MARKER
					)
				) {
					throw /* START_DEBUG */new _Grips.parser.ParserError("Unexpected Extend Tag",node) ||/* STOP_DEBUG */unknown_error;
				}
				tmp = tagExtend(node);
				collection += tmp;
				code += tmp;
			}
			else if (node.type === _Grips.parser.TAG_DEFINE) {
				tmp = tagDefine(node);
				collection += tmp;
				code += tmp;
			}
			else {
				throw /* START_DEBUG */new _Grips.parser.ParserError("Unexpected text outside of tag",node) ||/* STOP_DEBUG */unknown_error;
			}
		}

		return code;
	}

	var unknown_error = new Error("Unknown error"),
		needs
	;

	_Grips.generator = {
		process: process
	};

})(this,this.grips);
/* STOP_COMPILER */
