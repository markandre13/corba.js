# corba.js

Welcome to corba.js, an Object Request Broker (ORB) and Interface Definition
Language (IDL) compiler for TypeScript lousily based on the CORBA specification. (ISO/IEC 19500)

_CORBA is a registered trademark by the Object Management Group. http://www.corba.org/_

## What does it do?

CORBA helps to hide the split of modern WebApps into frontend and backend by making
remote objects appear like local objects.

For this objects, exceptions and data structures (aka DTOs), which need to bridge the
network, are described in the Interface Definition Language (IDL), which is then
compiled into code to be used in the application.

Data structures can even be pointer based ones like trees or cyclic graphs.

Frontend and backend can connect via WebSockets to carry CORBA's binary
GIOP protocol. In the future there will be also support for WebRTC and/or HTTP/3's
WebTransport, where the IDL's `oneway` keyword can make use of the unreliable
transport provided by these UDP based protocols.

## What does it not do?

CORBA's goal is to make frontend and backend look like one application, which implies tight coupling. Microservices on the other hand are intended to be loosely coupled.
Here a protocol like REST+JSON, 0MQ+MessagePack, etc. can be a better solution.

See also: [REST, SOAP, and CORBA, i.e. How We Got Here](https://greglturnquist.com/2016/05/03/rest-soap-corba-e-got/).

## Why?

corba.js is written to be used in [workflow](https://github.com/markandre13/workflow#readme) where it handles

* the communication between frontend and backend
* persisting objects to the database
* persisting objects to files (using CORBA's binary encoding GIOP)

In the 90ties CORBA was quite the hype but design-by-committee made it bloated, slow
and no fun to use. (See [The Rise and Fall of CORBA](https://queue.acm.org/detail.cfm?id=1142044) and [What's Wrong With CORBA](https://wiki.c2.com/?WhatsWrongWithCorba).)

Still, stripped to it's core, one finds a fast and lightweight system, which made it ideal for modern WebApps. This might be in part attributed to CORBA's roots in the experimental object oriented [Spring](https://en.wikipedia.org/wiki/Spring_(operating_system)) operating system and some sole individuals undermining the design-by-committee with their expertise. 😁

Around 2004 a group developers previously involed with CORBA and the OMG presented a much improved successor of CORBA, the [Internet Communications Engine](https://zeroc.com/products/ice) (ICE), which is also available for JavaScript/TypeScript under the GNU GPLv2.

Around 2012, CERN switched from CORBA to [0MQ](https://en.wikipedia.org/wiki/ZeroMQ) and a custom serializer.

## Interfaces

In the following example, a server will provide an object of type _Server_ and
the clients an object of type _Client_, which are to be defined in an IDL file:
```java
    interface Client {
        oneway void printMessage(in string message);
    }

    interface Server {
        oneway void registerClient(in Client client);
        double add(in double a, in double b);
    }
```

* `oneway` means that the client expects no confirmation that the call has
  reached it's destination.
* `in` specifies that the argument will not be written into to return data.
  (`out` and `inout` are not implemented by corba.js)

For each interface, the IDL compiler will generate stub and skeleton
classes:

* the stub class represents the remote object as if it is a local object
  within your program
* the skeleton class is the super class of the interface's implementation
  you will need to provide

Here are example implementations for the client and server defined earlier:

```javascript
    class Client_impl extends skel.Client {
        constructor(orb: ORB) {
            super(orb)
        }
    
        async printMessage(msg: string) {
            console.log(msg)
        }
    }

    class Server_impl extends skel.Server {
        clients: Array<Client>
    
        constructor(orb: ORB) {
            super(orb)
            this.clients = new Array<Client>()
        }
        
        async registerClient(client: stub.Client) {
            clients.push(client)
        }
        
        async add(a: number, b: number): number {
            for(client of clients)
                client.printMessage(`The server is adding $a and $b`)
            return a + b
        }
    }
```

The server side initialization:

```javascript
    import { WsProtocol } from "corba.js/net/ws"

    let orb = new ORB()
    
    // create the server implementation
    let server = Server_impl(orb)
    
    // assign a name to the object for client to search for
    orb.bind("MyServer", server)
    
    // for the server, the client is a remote object,
    // so we need to register the client's stub
    orb.registerStubClass(stub.Client)
    
    // listen for incoming WebSocket connections
    const protocol = new WsProtocol()
    orb.addProtocol(protocol)
    protocol.listen(orb, 8809)
```

The client side initialization:

```javascript
    import { WsProtocol } from "corba.js/net/browser"

    let orb = new ORB()
    orb.addProtocol(new WsProtocol())
    
    // for the client, the server is a remote object,
    // so we need to register the server's stub
    orb.registerStubClass(stub.Server)
    
    // find the object registered as "MyServer"
    const object = orb.stringToObject("corbaname::localhost:8809#MyServer")
    
    // try to cast it to type stub.Server
    let server = stub.Server.narrow(object)
    
    // we also want the server to call us thru our Client object
    let me = new Client_impl(orb)
    
    // we call the method we've defined to register client's
    server.registerClient(me)
    
    // call the server to add 3 and 2 and print the result returned
    // by the server
    // as a side effect, add() will also call printMessage() on all registered
    // client objects
    console.log(server.add(3, 2))
```

## Security Model

corba.js 0.0.x did not implement CORBA's security model and instead relies on
SSL/TLS and by restricting access to objects made public to the peer.

corba.js 0.1.x uses CORBA's IIOP protocol currently provides only
SSL/TLS and password login but no means to restrict access to individual
objects.

## Bind/Resolve

Ie. in the example above the side which provided the implementation
made the object publicly accessible via
```javascript
    let server = Server_impl(orb)
    orb.bind("MyServer", server)
```
and the side using the remote object gained access to it via
```javascript
    const server = stub.Server.narrow(
        await orb.stringToObject("corbaname::localhost:2809#MyServer")
    )
```
### Objects passed by reference

Ie. in the example above the client granted the server access to it's
Client object by passing it as a reference in a method call 
```javascript
    let client = Client_impl(orb)
    server.registerClient(client)
```
Any further access control must be dealt with by the application.

## ValueType

The IDL compiler represents IDL types as follows in TypeScript

IDL Type                         | TypeScript Type
-------------------------------- | ---------------
boolean                          | boolean
octet, short, long float, double | number
char, string                     | string
sequence&lt;T&gt;                | Array&lt;T&gt;
interface T                      | skel.T, stub.T

While IDL interfaces are used to provide communication between objects
registered at different ORBs, valuetypes can be used to exchange data
between them. When used as arguments in methods, CORBA will serialize
and deserialize them based on their IDL description:

```java
    valuetype Point {
        public double x, y;
    };

    valuetype Size {
        public double width, height;
    };
    
    valuetype Rectangle {
        public Point origin;
        public Size size;
        boolean contains(in Point point);
    };
```

For each valuetype the IDL compiler will generate three variants

* _value.ts: the valuetypes as TypeScript interfaces with only the attributes
* _valuetype.ts: the valuestypes as TypeScript interface with attributes and methods

Unlike a pure JSON exchange, corba.js will also instantiate a user specified
class to represent the transmitted data, so that the object has methods we
can call.

Ie. for this the Rectangle class will need a special constructor:

```javascript
    import { GIOPDecoder } from "corba.js"
    import * as value from "../myapp_value"
    import * as valuetype from "../myapp_valuetype"

    export class Rectangle implements valuetype.Rectangle {
        constructor(init?: Partial<value.Rectangle> | GIOPDecoder) {
            value.initRectangle(this, init)
        }
        contains(p: Point): boolean {
            return this.origin.x <= p.x && p.x <= this.origin.x + this.size.width &&
                   this.origin.y <= p.y && p.y <= this.origin.y + this.size.height
        }
    }
```

After the valuetype implementations have been registered in the ORB on client and server
side

```javascript
    ORB.registerValueType("Point", Point)
    ORB.registerValueType("Size", Size)
    ORB.registerValueType("Rectangle", Rectangle)
```

they can be send from one machine to the other, and the receiver will
instantiate the registered implementation of the class.

Methods in valuetypes may also use types which are not to be meant to
be exchanged between ORBs. These can be declared as 'native':

```java
    native Path;

    valuetype Figure {
        public unsigned long id;
        Path getPath();
    }
```

_NOTE: corba.js does not implement CORBA's capability to handle pointers, ie. when
two objects are referencing the same object, two instances of the object will be
created on the other side instead of one. This is going to change with the implementation of CORBA's binary encoding GIOP._

## IDL

The IDL mimics the CORBA 3.0 IDL grammar.

The CORBA IDL was derived from the Spring IDL, which was an object oriented
operating system research project at Sun Microsystems in the 80ties.

While this IDL parser is based on the CORBA 3.0 specification, it
implements only what is needed for the Workflow app (plus some things
which didn't require thinking like the full list of keywords and no
changes to the grammar).

## Protocol

corba.js does not implement the CORBA network protocol (GIOP/IIOP).

As corba.js is intended to ease the implementation of WebApps, it uses
JSON to be lightweight and efficient with some inspiration from JSON-RPC and EJSON.

## Development

All build stages are setup to run in watch mode for performance reasons.

* I ususally run `npm dev:build` in Visual Studio Code's terminal window to
  be able to jump from compiler errors directly into the source code.

* `npm dev:test` runs all tests in watch mode.

* `npm dev:test --file=lib/test/valuetype.spec.js` runs a single test file
  in watch mode.
