function normalizeSelector(sel) {

	// save unmatched text, if any
	function saveUnmatched() {
		if (unmatched) {
			// whitespace needed after combinator?
			if (tokens.length > 0 &&
				/^[~+>]$/.test(tokens[tokens.length-1])
			) {
				tokens.push(" ");
			}

			// save unmatched text
			tokens.push(unmatched);
		}
	}

	var tokens = [], match, unmatched, regex, state = [0],
		next_match_idx = 0, prev_match_idx,
		not_escaped_pattern = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/,
		whitespace_pattern = /^\s+$/,
		state_patterns = [
			/\s+|\/\*|["'>~+\[\(]/g, // general
			/\s+|\/\*|["'\[\]\(\)]/g, // [..] set
			/\s+|\/\*|["'\[\]\(\)]/g, // (..) set
			null, // string literal (placeholder)
			/\*\//g // comment
		]
	;

	sel = sel.trim();

	while (true) {
		unmatched = "";

		regex = state_patterns[state[state.length-1]];

		regex.lastIndex = next_match_idx;
		match = regex.exec(sel);

		// matched text to process?
		if (match) {
			prev_match_idx = next_match_idx;
			next_match_idx = regex.lastIndex;

			// collect the previous string chunk not matched before this token
			if (prev_match_idx < next_match_idx - match[0].length) {
				unmatched = sel.substring(prev_match_idx,next_match_idx - match[0].length);
			}

			// general, [ ] pair, ( ) pair?
			if (state[state.length-1] < 3) {
				saveUnmatched();

				// starting a [ ] pair?
				if (match[0] === "[") {
					state.push(1);
				}
				// starting a ( ) pair?
				else if (match[0] === "(") {
					state.push(2);
				}
				// starting a string literal?
				else if (/^["']$/.test(match[0])) {
					state.push(3);
					state_patterns[3] = new RegExp(match[0],"g");
				}
				// starting a comment?
				else if (match[0] === "/*") {
					state.push(4);
				}
				// ending a [ ] or ( ) pair?
				else if (/^[\]\)]$/.test(match[0]) && state.length > 0) {
					state.pop();
				}
				// handling whitespace or a combinator?
				else if (/^(?:\s+|[~+>])$/.test(match[0])) {
					// need to insert whitespace before?
					if (tokens.length > 0 &&
						!whitespace_pattern.test(tokens[tokens.length-1]) &&
						state[state.length-1] === 0
					) {
						// add normalized whitespace
						tokens.push(" ");
					}

					// whitespace token we can skip?
					if (whitespace_pattern.test(match[0])) {
						continue;
					}
				}

				// save matched text
				tokens.push(match[0]);
			}
			// otherwise, string literal or comment
			else {
				// save unmatched text
				tokens[tokens.length-1] += unmatched;

				// unescaped terminator to string literal or comment?
				if (not_escaped_pattern.test(tokens[tokens.length-1])) {
					// comment terminator?
					if (state[state.length-1] === 4) {
						// ok to drop comment?
						if (tokens.length < 2 ||
							whitespace_pattern.test(tokens[tokens.length-2])
						) {
							tokens.pop();
						}
						// otherwise, turn comment into whitespace
						else {
							tokens[tokens.length-1] = " ";
						}

						// handled already
						match[0] = "";
					}

					state.pop();
				}

				// append matched text to existing token
				tokens[tokens.length-1] += match[0];
			}
		}
		// otherwise, end of processing (no more matches)
		else {
			unmatched = sel.substr(next_match_idx);
			saveUnmatched();

			break;
		}
	}

	return tokens.join("").trim();
}

var tests = {
	/*test*/"#foo .bar":
	   /*expected*/"#foo .bar",
	/*test*/" #foo   .bar ":
	   /*expected*/"#foo .bar",
	/*test*/"#foo>.bar":
	   /*expected*/"#foo > .bar",
	/*test*/" unit[ sh | quantity = \"200\" ] ":
	   /*expected*/"unit[sh|quantity=\"200\"]",
	/*test*/"*~*>*.foo[ href *= \"/\" ]:hover>*[ data-foo = \"bar\" ]:focus+*.baz::after":
	   /*expected*/"* ~ * > *.foo[href*=\"/\"]:hover > *[data-foo=\"bar\"]:focus + *.baz::after",
	/*test*/"@media  screen  and  ( color ),  projection  and  ( color )":
	   /*expected*/"@media screen and (color), projection and (color)",
	/*test*/"@media  handheld  and  ( min-width : 20em ),   screen  and  ( min-width: 20em )":
	   /*expected*/"@media handheld and (min-width:20em), screen and (min-width:20em)",
	/*test*/"@media  screen  and  ( device-aspect-ratio : 2560 / 1440 )":
	   /*expected*/"@media screen and (device-aspect-ratio:2560/1440)",
	/*test*/"((a ) (b(c ) ) d )>*[ data-foo = \"bar\" ]":
	   /*expected*/"((a)(b(c))d) > *[data-foo=\"bar\"]",
	/*test*/"#foo[ a = \" b \\\" c\\\\\" ]":
	   /*expected*/"#foo[a=\" b \\\" c\\\\\"]",
	/*test*/" /*c1*/ .e1/*c2*/.e2 /*c3*/ .e3 /*c4*/ ":
	   /*expected*/".e1 .e2 .e3",
	/*test*/" /*c1*/ .e1/*c2*/.e2 /*c3*/ .e3 ":
	   /*expected*/".e1 .e2 .e3",
	/*test*/" /*c1*/ .e1/*c2*/.e2 /*c3*/ .e3":
	   /*expected*/".e1 .e2 .e3",
	/*test*/"/*c1*/.e1/*c2*/.e2 /*c3*/ .e3":
	   /*expected*/".e1 .e2 .e3",
	/*test*/".e1/*c2*/.e2 /*c3*/ .e3":
	   /*expected*/".e1 .e2 .e3"
};

var test, tmp;
for (test in tests) {
	if ((tmp = normalizeSelector(test)) && tmp === tests[test]) {
		console.log("PASSED: " + test + " (" + tmp + ")");
	}
	else {
		console.log("FAILED.\n Expected: " + tests[test] + "\n Received: " + tmp);
		break;
	}
}

console.log("Tests done.");
