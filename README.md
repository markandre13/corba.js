# corba.js

Welcome to corba.js, an Object Request Broker (ORB) and Interface Definition
Language (IDL) compiler in TypeScript/JavaScript based on the CORBA v3.0
specification.

CORBA is a registered trademark by the Object Management Group.
http://www.corba.org/

## Why?

This library is currently being written to develop <a
href="https://github.com/markandre13/workflow">workflow - A collaborative
real-time white- and kanban board</a>.

## IDL

The IDL mimics the CORBA 3.0 IDL grammar.

The CORBA IDL was derived from the Spring IDL, which was an object oriented
operating system research project at Sun Microsystems in the 80ties.

CORBA was quite a hype in its days and was used by OpenDoc (IBM, Apple),
Fresco (an X11 successor), KDE, ... but in the end it failed. Bloated,
huge, designed by comitee, ...

While this IDL parser is based on the CORBA 3.0 specification, it
implements only what is needed for my Workflow app (plus some things
which didn't require thinking like the full list of keywords and no
changes to the grammar).

In corba.js 'custom valuetype' is used to describe objects which will be
passed by value.  For now the contents of the valuetypes are ignored as the
current JavaScript ORB can serialize/deserialize objects on it's own for
now.

When using languages without reflexion (ie.  C++) or if not all attributes
are to be passed by value, the valuetype's content can be used.

## Protocol

The protocol takes some inspiration from JSON-RPC and EJSON.
