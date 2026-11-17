# CORBA IDL Syntax

Syntax highlighting for CORBA IDL files (`*.idl`) in the dialect parsed by
[corba.js](../..)'s IDL compiler in `src/idl/`.

Highlights keywords, built-in types, valuetype/interface/module names,
annotations such as `@js_mapping(...)`, `//` and `/* */` comments, and strings.

## Install

Copy or symlink this folder into your VS Code extensions directory, then reload VS Code:

    ln -s "$PWD" ~/.vscode/extensions/corba-idl-syntax

Or package it as a `.vsix` and install that:

    npx @vscode/vsce package
    code --install-extension corba-idl-syntax-0.1.0.vsix

## Source of truth

The keyword list mirrors the lexer's keyword switch in `src/idl/idl-lexer.ts`.
If keywords are added there, update `syntaxes/idl.tmLanguage.json` too.
