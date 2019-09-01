# corba.js

Welcome to corba.js, an Object Request Broker (ORB) and Interface Definition
Language (IDL) compiler in TypeScript/JavaScript based on the CORBA v3.0
specification.

CORBA is a registered trademark by the Object Management Group.
http://www.corba.org/

## Why? What?

* CORBA is an object oriented RPC library, which allows remote
  objects being treated as local objects and independent of the
  programming languages being used.
* After CORBA became more and more complicated through design by committee, CORBA was replaced by SOAP.
* After SOAP became more and more complicated, SOAP was replaced by REST.
* With the advent of WebApps and WebSockets, CORBA became feasible again.

corba.js is currently being written to develop <a
href="https://github.com/markandre13/workflow">workflow - A collaborative
real-time white- and kanban board</a>, which has so much communication
happening between the server and it's clients, that I wanted as much of the
network code being created automatically.

## Interfaces

In the following example, a server will provide an object of type _Server_ and
the clients an object of type _Client_, which are to be defined in an IDL file:
```
    interface Client {
        oneway printMessage(in string message);
    }

    interface Server {
        oneway registerClient(in Client client);
        double add(in double a, in double b);
    }
```

* 'oneway' is CORBA's version of 'void', meaning the method call will not
  return a result.
* 'in' specifies that the argument will not be written into to return data.
  ('out' and 'inout' are not implemented by corba.js)

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
    let orb = new ORB()
    
    // create the server implementation
    let server = Server_impl(orb)
    
    // assign a name to the object for client to search for
    orb.bind("MyServer", server)
    
    // for the server, the client is a remote object,
    // so we need to register the client's stub
    orb.registerStubClass(stub.Client)
    
    // listen for incoming WebSocket connections
    orb.listen("0.0.0.0", 8000)
```

The client side initialization:

```javascript
    let orb = new ORB()
    
    // for the client, the server is a remote object,
    // so we need to register the server's stub
    orb.registerStubClass(stub.Server)
    
    // connect to the WebSocket server
    orb.connect("ws://somehostname:8000/")
    
    // find the object registered as "MyServer"
    let object = await orb.resolve("MyServer")
    
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

Note to self: The narrow() is a classic CORBA function, but I guess we could reduce it to

    let server = await orb.resolve<Server>("MyServer")

## Security Model

corba.js does not implement CORBA's security model and instead relies on
SSL/TLS and by restricting access to objects to those exchanged via

### Bind/Resolve

Ie. in the example above the side which provided the implementation
made the object publicly accessible via
```javascript
    let server = Server_impl(orb)
    orb.bind("MyServer", server)
```
and the side using the remote object gained access to it via
```javascript
    let server = orb.resolve("MyServer")
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

IDL Type                        | TypeScript Type
------------------------------- | ---------------
boolean                         | boolean
float, double, short, long, ... | number
string                          | string
sequence&lt;T&gt;               | Array&lt;T&gt;
interface T                     | skel.T, stub.T

While IDL interfaces are used to provide communication between objects
registered at different ORBs, valuetypes can be used to exchange data
between them. When used as arguments in methods, CORBA will serialize
and deserialize them based on their IDL description:

```
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
* _valuetype.ts: the values types as TypeScript interface with attributes and methods
* _valueimpl.ts: the value types as classes with constructors, which can be initialized from JSON data

The last one will be used by the ORB to convert the received JSON data
into an object.

Unlike a pure JSON exchange, corba.js will also instantiate a user specified
class to represent the transmitted data, so that the object has methods we
can call.

Ie. the Rectangle class contains a method which needs to be implemented to
be able to instantiate it:

```javascript
    export class Rectangle extends valueimpl.Rectangle {
        constructor(rectangle: Partial<valueimpl.Rectangle>) {
            super(rectangle)
        }
        contains(p: Point): boolean {
            return this.origin.x <= p.x && p.x <= this.origin.x + this.size.width &&
                   this.origin.y <= p.y && p.y <= this.origin.y + this.size.height
        }
    }
```

After the valuetypes have been registered in the ORB on client and server
side

```javascript
    ORB.registerValueType("Point", valueimpl.Point)
    ORB.registerValueType("Size", valueimpl.Size)
    ORB.registerValueType("Rectangle", Rectangle)
```

they can be send from one machine to the other, and the receiver will
instantiate the registered implementation of the class.

Methods in valuetypes may also use types which are not to be meant to
be exchanged between ORBs. These can be declared as 'native':

```
    native Path;

    valuetype Figure {
        public unsigned long id;
        Path getPath();
    }
```

NOTE: corba.js does not implement CORBA's capability to handle pointers, ie. when
two objects are referencing the same object, two instances of the object will be
created on the other side instead of one. As this feature might simplify the implementation
of the Workflow App, it might be implemented for corba.js in the future.

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
