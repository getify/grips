# grips Templating Engine

<h3 id="trygrips"><a href="http://getify.github.com/grips/" target="_blank">Try Grips Online</a></h3>

grips is a simple-logic templating engine written in JavaScript. It's designed to work either/both in the browser or on the server, with the same code-base and the same template files.

grips will "compile" requested templates into JavaScript functions, which takes JSON data as input and returns the rendered string output. The compilation of templates can either be on-demand, or they can be pre-compiled in a build process and used later.

The design philosophy behind grips is not to be remarkable for what it can do, but to be **remarkable for what it cannot do**. That is to say, grips is as restrained in functionality as is necessary to accomplish all reasonable templating tasks.

If you find yourself needing to do something in templating that you cannot do with the features that grips provides, there's a good chance you're doing something you shouldn't be doing in templating. The goal is a minimal but capable set of logic for templating which in its limitations enforces (and encourages) responsible separation-of-concerns.

## Examples

The examples/ directory has several sample template files. Take a look at "tmpl.master.html" and "tmpl.index.html" in particular for good general real-world looking examples. "test.html" is more esoteric and shows off more complexities of the syntax nuances.

## Templating syntax

Template tags (as defined below) have a short/terse form and a long/friendlier form. You can mix and match the forms as you see fit. Examples may use the short form (for conciseness), but there's no reason to infer a preference either way. Some people prefer less templating cruft in their templates, others prefer more readable and less cryptic templates. To each his/her own. Just a matter of taste.

**NOTE:** For simplicity sake, when the engine prints a debug error message where it references a template tag, it always uses the short form for the tag, regardless of what it encountered in the original template.

### Define a named template section (aka, "partial")
Long-form:

```
{$define "#xxx" }
	...
	...
{$}
```

Short-form:

```
{$: "#xxx" }
	...
	...
{$}
```

### Define a named template section (partial), with local variable assignment(s)
`$` is the data object (context) passed into the partial.

```
{$: "#xxx" |
	x = $.val_1 |
	y = $.val_2
}
	...
	...
{$}
```

#### Conditional Assignments

```
{$: "#bar" |
	baz = $.baz ? "yes" : ""
}
	baz: {$= baz $}
{$}
```

The `else` condition of a conditional can be omitted and defaults to `""`.

```
{$: "#bar" |
	baz = $.baz ? "yes"
}
	baz: {$= baz $}
{$}
```

### Let-local Assignments
The Let tag provides a way to make a local variable assignment that only exists for the block it creates, which contains the assignment to a more limited scope than the Define tag and Loop tag assignments.

Long-form:

```
{$let foo = "foo" | bar = "bar" }
	...
{$}
```

Short-form:

```
{$# foo = "foo" | bar = "bar" }
	...
{$}
```

### Insert/print data property or variable
Long-form:

```
{$insert $.val_1 $}     {$insert myval $}
{$print $.val_1 $}      {$print myval $}
```

Short-form:

```
{$= $.val_1 $}     {$= myval $}
```

### Include template partial, by static literal
Long-form:

```
{$partial "#yyy" $}     {$insert @"#yyy" $}
```

Short-form:

```
{$= @"#yyy" $}
```

Template partials can be referenced either by only the (relative) `#partial-ID`, or by a full canonical `collection-ID#partial-ID` reference. If no `collection-ID` is specified, the current containing collection will be assumed.

**NOTE:** The short-form (and `{$insert ... $}`) requires the `@` symbol to distinguish a partial include from a data insertion. The long-form `{$partial ... $}` makes it more explicit in this case.

### Include template partial, by variable
Long-form:

```
{$partial $.val_1 $}     {$partial myval $}
```

Short-form:

```
{$= @$.val_1 $}     {$= @myval $}
```

### Manually specify data context for template partial include

```
{$= @"#yyy" | $.user $}
```

### Escaping (html, string, url) at the block-level

You can wrap a block-level escape tag around an arbitrary set of template content (inside a partial, of course), and it will cause the output of that section to be escaped according to which escaping rule(s) you specify.

There are 3 types of escaping rules you can choose from: `h` for html encoding, `s` for string (JavaScript, etc) escaping, and `u` for URL encoding/escaping. You can specify more than one rule together, but in most cases you'll probably just use one. If you specify no rule, the default is `s` (string).

The long-form of the rule(s) flag is `escape` or `escape h` or `escape hus`, etc. The short-form of the rule(s) flag is `~` or `~h` or `~hus`, etc.

Long-form:

```
{$: "#yyy" }
	Here is {$escape}string "escaped" content (by default){$}
	And here is {$escape h}html <em>encoded</em> content{$}
	Then, http://some.com/?a={$escape u}http://other.com{$}
	Finally, multiple {$escape hu}rules "can" be <a href="http://some.com">combined</a>.{$}
{$}
```

Short-form:

```
{$: "#yyy" }
	Here is {$~}string "escaped" content (by default){$}
	And here is {$~h}html <em>encoded</em> content{$}
	Then, http://some.com/?a={$~u}http://other.com{$}
	Finally, multiple {$~hu}rules "can" be <a href="http://some.com">combined</a>.{$}
{$}
```

### Escaping (html, string, url) at the tag-level

You can apply escaping/encoding rules to a `{$insert .. $}` or `{$partial .. $}` tag directly, without needing to wrap it in a block-level escaping tag. You have the same 3 rule choices as for block-level escaping rules (see above).

The form of the rule(s) flag is `~` or `~h` or `~hus`, etc, regardless of whether the tag is long-form or short-form. **NOTE:** the "long-form" of the rule(s) flag (`escape ..`) itself is not supported for tag-level escaping.

Used with long-form tags:

```
{$: "#yyy" }
	Here's a tag-level (string) escaping: <script>var foo = "{$insert~ $.foo $}";</script>
	Here's more tag-level (html) escaping with a partial include: {$partial~h "#zzz" $}
{$}
```

Used with short-form tags:

```
{$: "#yyy" }
	Here's a tag-level (string) escaping: <script>var foo = "{$=~ $.foo $}";</script>
	Here's more tag-level (html) escaping with a partial include: {$=~h @"#zzz" $}
{$}
```

### Loop on data variable (array or plain key/value object)
`_` is the current iteration binding, and it includes:

* `index` (numeric: zero-based positional index)
* `key` (string: for object iteration, the property name; for array iteration, the `index`)
* `value` (actual item value)
* `first`
* `last`
* `odd`
* `even`

Long-form:

```
{$loop $.val_1 }
	...
	key: {$insert _.key $}    value: {$insert _.value $}
	...
{$}
```

Short-form:

```
{$* $.val_1 }
	...
	key: {$= _.key $}    value: {$= _.value $}
	...
{$}
```

### Loop on data variable, with loop iteration local variable assignment(s)

```
{$* $.val_1 |
	rowtype = _.odd ? "#oddrow" : "#evenrow" |
    someprop = _.value.someProp ? "#hassomeprop"
}
	...
	{$= @rowtype $}
	...
	{$= @someprop $}
	...
{$}
```

### Range Literals

```
{$* [2..7] } <!-- let's count from 2 to 7 -->
	counting: {$= _.value $}
{$}
```

```
{$* [4..-3] } <!-- count down from 4 to -3 -->
	counting: {$= _.value $}
{$}
```

### Set Literals

```
{$* ["Jan", "Feb", "Mar"] } <!-- show the months in Q1 -->
	month: {$= _.value $}
{$}
```

### Precomputing hash literals
Hash literals can be pre-computed against a defined set or range of values. In the below examples, the value of `$.myradio` will be compared to all values in the range/set (0,1,2 or "low","medium","high"). The results of the comparison and conditional assignment are stored in a local variable hash, keyed by the comparison values. For instance, in the below example, one of the three pre-computation comparisons/assignments the syntax implies is: `checked[1] = ($.myradio === 1) ? "checked" : ""` (same for values 0 and 2).

```
{$: "#bar" |
	checked[0..2] = $.myradio ? "checked"
}
	<input type="radio" name="myradio" value="0" {$= checked[0] $}>
	<input type="radio" name="myradio" value="1" {$= checked[1] $}>
	<input type="radio" name="myradio" value="2" {$= checked[2] $}>
{$}
```

Using a loop the above can be even more terse:

```
{$: "#bar" |
	checked[0..2] = $.myradio ? "checked"
}
	{$* [0..2] }
		<input type="radio" name="myradio" value="{$= _.value $}" {$= checked[_.value] $}>
	{$}
{$}
```

Here's a "trick" for even more terseness, by iterating over the pre-computed comparison hash:

```
{$: "#bar" |
	options[0..2] = $.myradio ? "checked"
}
	{$* options }
		<input type="radio" name="myradio" value="{$= _.key $}" {$= _.value $}>
	{$}
{$}
```

Pre-computation with a set-literal:

```
{$: "#bar" |
	checked["low","medium","high"] = $.myradio ? "checked"
}
	<input type="radio" name="myradio" value="low" {$= checked["low"] $}>
	<input type="radio" name="myradio" value="medium" {$= checked["medium"] $}>
	<input type="radio" name="myradio" value="high" {$= checked["high"] $}>
{$}
```

### "Extend" (inherit from) another template collection
Long-form:

```
{$extend "collection-ID" $}
```

Short-form:

```
{$+ "collection-ID" $}
```

Template collections are an arbitrary grouping of one or more template partials. Usually a template collection corresponds to a file. A template collection can "extend" another template collection, in a similar way you'd be used to having one class extend another class.

A template collection that extends another collection means that it "inherits" the template partials from the collection it extends. You can reference those template partials in template-includes, even if they don't exist in the current template collection. You can also override a template partial that was inherited, simply by defining it in the current collection.

If you reference a partial for inclusion, the engine will start at the appropriate collection level and look for the partial there, and if not found, will walk up the extension chain, if any, looking for a matching partial.

For example, collection "foo":

```
{$: "#baz" } baz {$}
{$: "#bam" } bam {$}
```

And collection "bar":

```
{$+ "foo" $}

{$: "#baz" }
	Foobar {$= @"foo#baz" $} {$= @"#bam" $}
{$}
```

In this example, `bar` extends `foo`, and `#baz` and `#bam` are inherited from `foo` into `bar`. `#baz` is redefined in `bar`, but the original inherited version can be referenced by giving the full `foo#baz` template reference. Finally, since `#bam` was inherited, it can be referenced even without the full template reference.

### Raw unparsed section
Long-form:

```
{$raw
	this stuff {$= won't be parsed $}, just passed through raw
%$}
```

Short-form:

```
{$%
	this stuff {$= won't be parsed $}, just passed through raw
%$}
```

### Template comment block
Long-form:

```
{$comment comments get removed
	in parsing /$}
```

Short-form:

```
{$/ comments get removed
	in parsing /$}
```

## Debug vs. Non-Debug

grips can either be used in debug mode or non-debug mode, controlled by which version of the library file/module you include. The debug version of the library has friendly error handling, and also produces compiled templates with friendly error handling, whereas the non-debug library (and templates compiled by it) will simply throw a generic "Unknown error" for any errors encountered.

It is recommended that during development you use the debug version of the library, as it will greatly assist in understanding grips template syntax and behavior. But once you deploy grips and/or compiled templates to production, use the non-debug version of the library, because both the library and the compiled templates will be significantly smaller with debug bits stripped.

For browser usage (either basic or AMD-style), choose the appropriate file with or without the "-debug" in the filename. For node.js module usage, you select which version of the library you want to use directly on the included module.

```js
var grips_nondebug = require("grips").grips,
    grips_debug = require("grips").debug;
```

## Full Compiler vs. Runtime

For browser usage (either basic of AMD-style), you can choose to include the full compiler, or just the runtime bits. The runtime is all that's required if you only plan to render pre-compiled templates. If you need to actually compile templates in the browser (usually pretty rare), include the full lib. Otherwise, you should include the **much smaller** runtime only.

The most typical production usage pattern would be to have a build process (see the `grips` CLI tool section below) that precompiles your templates, and includes them all together in a single script file (ex: "template-bundle.js"). In that scenario, you'd most likely want to **prepend** the runtime library file to the **beginning** of that template bundle file, so you'd only need to load that one combined file in the browser.

## Installing, Deploying

If you plan to use grips only in a browser, simply download the appropriate file(s) from the "deploy" directory of this repository, and use them in your page using a standard `<script src="...">` type include, bundle the file(s) with your other code, or load them with a dynamic script loader or dependency manager.

If you plan to use grips on the server (in node.js), install it with npm:

```
npm install grips
```

If you want to use the `grips` CLI tool and the `grips-build` build tool from your command line, and you want those binaries added to your normal system bin path, you can instead install grips globally, by adding a "-g" to your `npm install` command.

Once installed with npm, you will have a "./node_modules/grips/deploy" directory, and there is where you will find the files you need to deploy for browser usage, as just described.

To use the grips module in a node.js script, you simply call `require("grips")`, and on that module object, you choose either the debug version of the library with `require("grips").debug` or the non-debug version with `require("grips").grips`.

## API

The JavaScript API is accessible in a couple of different ways. The raw library can be loaded in a traditional fashion in a browser, and will produce a single global symbol called `grips`. It can be loaded as an AMD module, using the "amd-*.js" versions of the files (assuming they were built with the `grips-build` tool). And finally, you can use the "grips" module in node.js code (see above).

Regardless of how you include the library and get access to the core `grips` API, the following methods and signatures are all available. The only caveat is that if you load the runtime version of the library (which has the compiler stripped), only the runtime parts (`initialize`, `render`, etc) of the API are available.

The two most typical tasks for the JavaScript API are `compileCollection()` and `render()`.

grips organizes template partials by grouping them together in collections. A single collection is an arbitrary grouping of one or more partials, but it usually will correspond to a single template file. The collection-ID is arbitrary, but again, will usually be the filename of the template file.

You will render an individual partial, but you will compile a collection of one or more partials.

### Compiling a collection
To compile a collection of partials, call `compileCollection(templateStr, collectionID, [initialize=true])`.

`templateStr` is the string representation of your collection of template partials. `collectionID` should be the same as any other references to the collection by ID, such as other absolute template includes, or template extend directives, in other collections.

`initialize`, which defaults to true, is an optional boolean flag. If `true`, it will evaluate the compiled template function representation, so that it's ready to render. You'd pass `false` for this parameter if you were only doing pre-compilation of templates, for instance in a build process, and didn't need them to be intialized for rendering at that time.

`compileCollection()` returns you the string value of that compiled template function, so you can choose to store it in a file during a build process, etc.

A collection-ID is the first part of a canonical template-ID (`foo` in `"foo#bar"`, whereas `#bar` is the partial-ID). The `{$+ ... $}` collection extend tag takes **only** the collection-ID (like `foo`), without any partial-ID.

```js
grips.compileCollection("{$: '#bar' } Hello {$= $.name $}! {$}", "foo");
```

For convenience, if you want to compile several collections at once, use `compile(sources, [initialize=true])`. The `sources` parameter is an object whose keys are used as the collection names and whose values are the collection template sources.

```js
grips.compile({
	foo: "{$: '#bar' } Hello {$= $.name $}! {$}"
});
```

### Rendering a partial
If one or more collections have been compiled and initialized, they can then be rendered by calling `render(templateID, data)`.

To render a partial using the JavaScript API, you must refer canonically to its full `templateID` by both the partial-ID and the collection-ID of the collection in which it lives. For example, for `"foo#bar"`, `foo` is the collection-ID and `#bar` is the partial-ID.

```js
var markup = grips.render("foo#bar", {
	name: "World"
});
```

### Other methods
Since you can pre-compile templates during a build process and store them in files for later use in production, you can call `initializeCollection()` (or `initialize()`) to evaluate the source of a compiled template collection's functions.

For instance, if you had the compiled functions for the `foo` collection in source form (from a file), you can initialize them (so they're ready for rendering) by either `eval()`ing them yourself, or with `initializeCollection(collectionID, compiledSource)`.

```js
eval(fooCompiledSource);

// or

grips.initializeCollection("foo", fooCompiledSource);
```

And if you have two or more collections in one big string (like one file), you can just call `initialize(compiledSourceBundle)`.

```js
eval(compiledSource);

// or

grips.initialize(compiledSource);
```

## Using the grips CLI

grips comes with a node.js tool called `grips` (I know, creative, right!?), in the "bin/" directory, which is a CLI tool for compiling, initializing, and rendering templates.

Here are the options for the CLI tool:

```
usage: grips opt [, ..opt]

options:
--help                                    show this help

--nodebug                                 use the non-debug library
--keep-paths                              for --compile, keep the full path in the collection-ID, instead of just the filename
--minify                                  minify compiled templates with uglify.js

--compile=file                            compile a template file (using {file} as the collection-ID)
--initialize=file                         initializes an already compiled template collection from a file
--render='{collection-ID}#{partial-ID}'   render the specified partial, using data from stdin
```

The `--compile` flag can be passed multiple times, once for each file you want to compile. By default, only the filename itself will be used as the collection-ID, however if you pass `--keep-paths`, then the full path you specify for a file will be used as the collection-ID. NOTE: a collection-ID (filename, file path) must not include a `#` character, as that is the separator between collection-ID and partial-ID.

If a `--render` flag is not passed, the output from the compilation (`--compile`) will be printed to the stdout. Otherwise, the output will be the rendered output.

If you want to initialize (to prepare for rendering) an already compiled collection (in one or more files), use `--initialize`.

If you have compiled templates, or initialized already compiled templates, then you can render one or more partials using `--render`. You must specify both the collection-ID and the partial-ID. `--render` also requires that you provide the JSON data for your template rendering via stdin.

```
bin/grips --compile=templates/foo.bar.html --compile=templates/baz.html > tmpl-bundle.js
echo "{\"some\":\"data\"}" | bin/grips --initialize=tmpl-bundle.js --render='baz.html#foobar'
..
echo "{\"some\":\"data\"}" | bin/grips --compile=templates/foo.bar.html --compile=templates/baz.html --render= 'baz.html#foobar'
```

## Building grips

grips comes with a node.js tool called `grips-build`, in the "bin/" directory, which when run will generate the files you need to use grips, in a directory called "deploy".

There are a few simple options for the `grips-build` tool:

```
usage: grips-build [opt, ...]

options:
--help       show this help
--verbose    display progress

--full       builds only the full compiler+runtime package
--runtime    builds only the stripped down (no compiler) runtime separately
--debug      builds all files only with debug code included (graceful error handling, etc)
--nodebug    builds all files only with debug code stripped (smaller files, but with less graceful error handling)

--amd        also builds AMD style files (amd-*.js files)
--node       also builds node.js compatible module files
--minify     also minifies all built files with uglify.js (*.min.js files)

--all        build all possible files/options

Defaults:
If you pass neither --full nor --runtime, --full will be assumed.
If you pass neither --debug nor --nodebug, --debug will be assumed.
```

By default, the `grips-build` tool is silent, meaning it outputs nothing to the console unless there are errors. If you'd like verbose output, pass the `--verbose` flag.

`--full` builds the full compiler+runtime together. `--runtime` builds only the stripped down (no compiler) runtime separately. Both flags can be passed to build both options. If you pass neither `--full` nor `--runtime`, `--full` will be assumed.

`--debug` includes debug code (graceful error handling, etc) in both the library and the compiled templates it will produce. `--nodebug` strips all debug code from the library (and thus from any compiled templates it will produce). Both flags can be passed to build both options. If you pass neither `--debug` nor `--nodebug`, `--debug` will be assumed. **For production usage, it is strongly recommended to use the `--nodebug` built files.**

`--amd` also builds the AMD style version of any built files. `--node` also builds the node.js modules. `--minify` also minifies all built files (using "uglify.js").

Finally, `--all` will build all files and option combinations.

## Linting grips templates

The `grips-lint` tool is a work in progress, but aims to be a simple linting tool to help you check your templates for a variety of bad practices and potential pitfalls. Right now, it only performs a few simple checks, but of course, there will be plenty more checks coming.

Also, right now, there's only one level of warning, but `grips-lint` will eventually let you configure specific warnings into different levels, and set thresholds for which warnings you want to see. To effectively disable a warning, you'll be able to set it to a level that is below the allowed threshold, thereby hiding it.

Right now, the options for `grips-lint` tool are pretty limited. More will be added as this tool matures.

```
usage: grips-lint opt [, ..opt]

options:
--help                                    show this help
--verbose                                 display progress

--file=file                               specify a collection file to be checked
```

## Performance Benchmarks

Performance optimization is not really a primary design-goal of grips. If you were simply wanting the fastest performance possible, raw JavaScript written specifically to produce your desired strings would be the limit. Any "templating" logic involved would be boilerplate which couldn't help but "get in the way" and slow it down, even just a little bit.

grips is far more concerned with creating a proper and responsible templating language and environment. However, performance cannot be ignored, because a templating engine which is impractically slow for real-world usage does no good.

As such, grips participates in some of the performance benchmarking by which other engines are tested, to make sure that its performance is acceptable and balanced against its feature set.

[Revision 46 of the "JavaScript Templating Shootoff"](http://jsperf.com/javascript-templating-shootoff-extended/46) includes grips tests. In general, grips is performing well, comparable to other well known engines like Dust.js.

[grips performance](http://jsperf.com/grips-performance/3) is a grips-specific performance test (using the same template snippet from the "shootoff"), which is used for regression testing as grips is improved going forward.

The main takeaway from these numbers is that, in general, grips can render thousands of partials in just a few milliseconds, which means that it almost certainly will never be a performance bottleneck in your client-side application.

The `grips-perf` tool runs the templating scenario from [grips performance](http://jsperf.com/grips-performance/3) test in node.js (using benchmark.js) and reports benchmark numbers for 3 different tests: "compilation", "direct-partial" (from partials cache), and "render()".

## License

grips (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/
