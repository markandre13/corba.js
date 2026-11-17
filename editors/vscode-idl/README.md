# CORBA IDL Syntax

Syntax highlighting for CORBA IDL files (`*.idl`) in the dialect parsed by
[corba.js](../..)'s IDL compiler in `src/idl/`.

Highlights keywords, built-in types, valuetype/interface/module names,
method names (`entity.name.function`), custom type names (`entity.name.type`),
annotations such as `@js_mapping(...)`, `//` and `/* */` comments, and strings.
Method and custom type names use separate scopes, so themes can color them differently.

## Install

Copy or symlink this folder into your VS Code extensions directory, then reload VS Code:

    ln -s "$PWD" ~/.vscode/extensions/m13-corba-idl

Or package it as a `.vsix` and install that:

    npx @vscode/vsce package
    code --install-extension m13-corba-idl-0.1.0.vsix

## Source of truth

The keyword list mirrors the lexer's keyword switch in `src/idl/idl-lexer.ts`.
If keywords are added there, update `syntaxes/idl.tmLanguage.json` too.
