# glue.js
Welcome to the glue.js, an Object Request Broker (ORB) and Interface Definition Language (IDL) compiler

This library is currently being written to develop <a
href="https://github.com/markandre13/workflow">workflow - A collaborative
real-time white- and kanban board</a>.

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

The protocol takes some inspiration from JSON-RPC.
