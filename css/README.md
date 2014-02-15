# grips-css

## Overview

LESS/SASS/Compass style CSS pre-processing is basically the same set of techniques as HTML templating. So, instead of having two different tools that do basically the same thing (text templating), grips has a pre-processor for CSS*-like syntax which allows you to use the same CSS pre-processing techniques you're already familiar with, to do your CSS generation via the grips templating engine.

This gist shows off a LESS-like syntax for CSS in the grips engine whereby you can get most of the major benefits (variables, mixins, nesting, etc).

**NOTE:** Just like with LESS, `gcss` is a superset of normal CSS, which means that you could compile a standard CSS file with grips-css, and it just wouldn't have any of the dynamic features.

The main benefit, besides using one tool vs. two, is that because you're using a templating engine, you maintain your variables **outside your CSS**, just like you maintain data outside your HTML when normal templating is considered.

So, imagine different versions of "2.js" like that below, where you had different color/radius values for different site themes, and all you have to do is switch out your data and you get a "themed" CSS file as output, without needing to do any re-parsing of the CSS source file. That has the same obvious performance benefits as it does for HTML templating.

## How It Works

The grips CSS pre-processor translates the LESS-like `.gcss` syntax first to the standard grips templating syntax, and then you can use those templates to generate final CSS output files. Because it's a pre-processing step, it happens before your normal templating, and just generates an additional set of templates for your build process to compile and manage.

Once you have compiled templates for your CSS files (along with your HTML files), you do the same thing you'd do for HTML, which is to render your final CSS output by providing the appropriate variables as data to the `render(..)` method.

## Syntax Explanation
`rule (variableName:default) { ... }` means you are defaulting the named variable, for the context of this rule only, as the default value you provide. The default will only be used if that variable name doesn't have a value already.

`*prop` means you want to have that property "expanded" to include all the standard vendor prefixes ("-webkit-", "-moz-", etc), as well as the unprefixed version.

`=variableName` means to drop in the value of a variable by that name.

`.rule` or `#rule` is the "mixin" syntax, which means to include the contents of the most recent definition matching that exact rule name. So, below, `.menu` means to get the contents of the `.menu { ... }` and drop them right in place. All normal resolution of variables and other mixins is also performed before the result is dropped in.

`rule|variableName:value` means to include the mixin, while setting the variable by the given name to the given value. Multiple "parameters" can be set by separating them with the `|` character, as shown.

`rule1 { ... rule2 { ... } ... }` is the "nesting" syntax you're familiar with, where the unnested end result is `rule1 { ... } rule1 rule2 { ... }` as you're used to.

`@import "file.gcss"` works as you'd expect, first importing the contents of that file and then compiling and rendering as is obvious.
