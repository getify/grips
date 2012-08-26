# grips Templating Engine

**NOTE: this project used to be called "HandlebarJS". To avoid confusion with the newer but more popular "Handlebars" templating engine from @wycats, I'm renaming this project to "grips".**

grips is a simple templating engine written in JavaScript. It's designed to work either/both in the browser or on the server, with the same code-base and the same template files.

grips takes as its only input data in a simple JSON data-dictionary format, and returns output from the template(s) selected.

grips will "compile" requested templates into executable JavaScript functions, which take the JSON data dictionary as input and return the output. The compilation of templates can either be JIT (at request time) or pre-compiled in a build process.

## Examples:

The examples/ directory has some sample template files.

## Templating sytax:

### Define a named template section (aka, "partial")

	{$: "#xxx" }
	
		...
	
	{$}

### Define a named template section, with data initialization expression(s)

	{$: "#xxx" | x = data.val1 | y = data.val2 ? "#yyy" : "#zzz" }
	
		...
	
	{$}

### Replace tag with data variable

	{$= data.value $}

### Include template section

	{$= @"#yyy" $}

### Include template section from data variable

	{$= @value $}

### Loop on data variable (array or plain key/value object)

	{$* data.value }
	
		...
	
	{$}

### Loop on data variable, with loop iteration initialization expression(s)
  `item` iteration binding has: 
    `key` (index), `value`, `first`, `last`, `odd`, and `even`

	{$* data.value | rowtype = item.odd ? "#oddrow" : "#evenrow" | 
	     someprop = item.value.someProp ? "#hassomeprop" }
	
		...
		{$= @rowtype $}
		...
		{$= @someprop $}
		...
		{$= item.value.otherProp $}
		...
	
	{$}

### "Extend" (inherit from) another template file

	{$+ "template/file.url" $}

### Raw un-parsed section

	{$%
	
		...
	
	%$}

### Template comment block

	{$/
	
		...
	
	/$}
