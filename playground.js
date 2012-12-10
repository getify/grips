function strip(str) {
	return str.replace(/^[\s\n\r]+/,"").replace(/[\s\n\r]+$/,"");
}

function nl2br(str) {
	return str.replace(/\n/g,"<br>").replace(/\r/g,"");
}

function emptyCompiledRendered() {
	$td_compiled.html(_GRIPS_.render("tmpls.html#td_compiled",{
		compiles:[
			{
				collection_id: "",
				collection_compiled: "",
				compile_source: ""
			}
		]
	}));
	$td_rendered.html(_GRIPS_.render("tmpls.html#td_rendered",{
		collection_id: "",
		partial_id: "",
		render_data: "{}",
		rendered: ""
	}));
}

function shortenStr(str,length) {
	return str.substr(0,length) + (str.length > length ? "..." : "");
}

function updateCompileRender(sources,data) {
	var src = $usedebug.is(":checked") ? GRIPS_DEBUG_URL : GRIPS_URL;

	$(".source_error, .data_error, .render_error").empty().hide();

	$LAB.script(src).wait(function(){
		var i, to_compile, compile, compiles = [], rendered = "", render_error = "",
			collection_id, data_context, partial_id = "#main",
			compile_success = false, render_success = false
		;

		prev_sources = sources;
		prev_data = data;

		$td_source.html(_GRIPS_.render("tmpls.html#td_source",{ sources: sources }));
		$td_data.html(_GRIPS_.render("tmpls.html#td_data",{ data: data }));

		try {
			for (i=0; i<sources.length; i++) {
				collection_id = sources[i].collection_id;

				to_compile = {};
				to_compile[collection_id] = sources[i].collection_source;
				compile = {
					collection_id: "",
					collection_compiled: "",
					compile_source: shortenStr(sources[i].collection_source.replace(/\n/g,""),30)
				};
				compiles.push(compile);

				compile.collection_compiled = strip(grips.compile(to_compile,/*initialize=*/true));
				compile.collection_id = collection_id;
			}
			compile_success = true;
		}
		catch (err) {
			$td_source.find("textarea:eq(" + i + ")").addClass("bad");
			$td_source.find(".source_error").html(nl2br(err.toString())).show();
			compiles[i].compile_source = "";
		}

		$td_compiled.html(_GRIPS_.render("tmpls.html#td_compiled",{ compiles: compiles }));
		if (compile_success) {
			$td_source.find("textarea").addClass("good");
			$td_compiled.find("textarea").addClass("good");
		}

		try {
			if (data) {
				data_context = JSON.parse(data);
				$td_data.find("textarea").addClass("good");
			}
			if (compile_success && data) {
				rendered = grips.render(collection_id + partial_id,data_context);
				render_success = true;
			}
			else {
				collection_id = "";
				partial_id = "";
				data_context = {};
				rendered = "";
			}
		}
		catch (err) {
			if (
				(!grips.TemplateError || err instanceof grips.TemplateError) &&
				!(err instanceof SyntaxError)
			) {
				render_error = err.toString();
			}
			else {
				$td_data.find(".data_error").html(nl2br(err.toString())).show();
				$td_data.find("textarea").addClass("bad");
				collection_id = "";
				partial_id = "";
				data_context = {};
				rendered = "";
			}
		}

		$td_rendered.html(_GRIPS_.render("tmpls.html#td_rendered",{
			collection_id: collection_id,
			partial_id: partial_id,
			render_data: shortenStr(JSON.stringify(data_context),30),
			rendered: rendered
		}));

		if (render_error !== "") {
			$td_rendered.find(".render_error").html(nl2br(render_error)).show();
			$td_rendered.find("textarea").addClass("bad");
		}
		else if (render_success) {
			$td_rendered.find("textarea").addClass("good");
		}

		grips.noConflict();
	});
}

function changeSampleTemplate() {
	var selected_sample_template = $sampletemplate.val(),
		sources = [], render_data = ""
	;

	$td_source.html(_GRIPS_.render("tmpls.html#td_source",{
		sources:[
			{
				collection_id: "n/a",
				collection_source: ""
			}
		]
	}));
	$td_data.html(_GRIPS_.render("tmpls.html#td_data",{ data: "" }));
	emptyCompiledRendered();

	switch (selected_sample_template) {
		case "1":
		case "2":
		case "3":
		case "4":
		case "5":
		case "6":
		case "7":
		case "8":
		case "9":
		case "10":
		case "11":
		case "12":
		case "13":
		case "14":
		case "15":
		case "16":
		case "17":
		case "18":
		case "19":
		case "20":
		case "21":
		case "22":
		case "23":
		case "24":
		case "25":
		case "26":
		case "27":
		case "31":
		case "32":
		case "33":
		case "34":
		case "35":
		case "36":
		case "37":
		case "38":
			sources.push({
				collection_id: "sample_tmpl_" + selected_sample_template,
				collection_source: strip(_GRIPS_.render("tmpls.html#sample_tmpl_" + selected_sample_template,{}))
			});
			render_data = strip(_GRIPS_.render("tmpls.html#sample_data_" + selected_sample_template,{}));
			break;
		case "28":
		case "29":
		case "30":
			sources.push(
				{
					collection_id: "sample_tmpl_" + selected_sample_template + "_a",
					collection_source: strip(_GRIPS_.render("tmpls.html#sample_tmpl_" + selected_sample_template + "_a",{}))
				},
				{
					collection_id: "sample_tmpl_" + selected_sample_template + "_b",
					collection_source: strip(_GRIPS_.render("tmpls.html#sample_tmpl_" + selected_sample_template + "_b",{}))
				}
			);
			render_data = strip(_GRIPS_.render("tmpls.html#sample_data_" + selected_sample_template,{}));
			break;
		default:
			break;
	}

	if (sources.length > 0) {
		updateCompileRender(sources,render_data);
	}
}

function changeInputs() {
	var sources = [];
	$td_source.find(".tsource").each(function(){
		var source = $(this).val(),
			collection_id = $(this).attr("data-collection-id")
		;
		if (/[^\s\r\n]/.test(source)) {
			sources.push({
				collection_id: collection_id,
				collection_source: source
			});
		}
	});

	if (sources.length > 0) {
		updateCompileRender(sources,$td_data.find("textarea").val());
	}
	else {
		prev_data = $td_data.find("textarea").val();
		prev_sources = sources;
		emptyCompiledRendered();
	}
}

function checkInputs() {
	var i=0, changed = false;

	$td_source.find(".tsource").each(function(){
		var source = $(this).val(),
			collection_id = $(this).attr("data-collection-id")
		;
		if (!prev_sources[i] ||
			prev_sources[i].collection_source !== source ||
			prev_sources[i].collection_id !== collection_id
		) {
			changed = true;
		}
		i++;
	});

	if (prev_data !== $td_data.find("textarea").val()) {
		changed = true;
	}

	if (changed) {
		changeInputs();
	}
}

var $sampletemplate = $("#sampletemplate"),
	$usedebug = $("#usedebug"),
	$minify = $("#minify"),
	$td_source = $("#td_source"),
	$td_compiled = $("#td_compiled"),
	$td_data = $("#td_data"),
	$td_rendered = $("#td_rendered"),

	prev_sources = [],
	prev_data,

	_GRIPS_ = grips.noConflict(),
	GRIPS_DEBUG_URL = "https://raw.github.com/getify/grips/master/deploy/grips-full.debug.js",
	GRIPS_URL = "https://raw.github.com/getify/grips/master/deploy/grips-full.js"
;

$LAB.setGlobalDefaults({
	AllowDuplicates: true
});

// preload the libs
var preloading =
$LAB
.script(GRIPS_DEBUG_URL).wait(function(){grips.noConflict();})
.script(GRIPS_URL).wait(function(){
	grips.noConflict();

	$sampletemplate.bind("change",changeSampleTemplate);
	$usedebug.bind("change",changeInputs);
	$td_source.on("blur","textarea",checkInputs);
	$td_data.on("blur","textarea",checkInputs);

	changeSampleTemplate();
});