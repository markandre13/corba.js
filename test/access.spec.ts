/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2021 Mark-André Hopf <mhopf@mark13.org>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { expect } from "chai"

import { ORB, CORBAObject } from "corba.js"
import { TcpProtocol } from "corba.js/net/socket"
import * as iface from "./generated/access"
import * as skel from "./generated/access_skel"
import * as stub from "./generated/access_stub"
import { mockConnection } from "./util"

// Security Service Specification, v1.8, March 2002 is obsolete and
// replaced by the Common Secure Interoperability Version 2 (CSIv2) as defined in
// CORBA 3.4, Part 2, 10 Secure Interoperability
//
// It
// * it assumes that the transport level protocol already provides protection
//   (confidentiality & integrity) and also authenticates the server like SSL/TLS
// * defines the CORBA Security Attribute Service (SAS) protocol
// * the protocol is modeled is based on GSSAPI (Kerberos) and hence includes the
//   use of ASN.1 encoding
// * SAS is using the ServiceContext of GIOP request and reply messages
// * The ServiceId is 15
// * CSS: client security service
// * TSS: target security service

// CORBA 3.4 Part 1 refers to SecurityCurrent in the Security Service Specification v1.5 (formal/00-06-25)
// but neither MICO, OmniORB nor JacORB really implement that stuff.
// Hence instead I take a page from 
// https://www.novell.com/documentation/extend5/Docs/help/MP/orb/tutorial/poaBankSecure-1.htm
// Novel licenced VisiBroker in 1997, which was also bought by Borland 
// it has a "VBSecurityContext"

// SecurityService

// EstablishContext
// ContextError
// CompleteEstablishContext
// MessageInContext

// page 176, that's the SAS message the client sends
// struct EstablishContext {
//     ContextId client_context_id;
//     AuthorizationToken authorization_token;
//     IdentityToken identity_token;
//     GSSToken client_authentication_token;
// };
//
// union SASContextBody switch ( MsgType ) {
//     case MTEstablishContext: EstablishContext establish_msg;
//     case MTCompleteEstablishContext: CompleteEstablishContext complete_msg;
//     case MTContextError: ContextError error_msg;
//     case MTMessageInContext: MessageInContext in_context_msg;
// };

// 10.9.1 Nodule GSSUP - Username/Password GSSAPI Token Formats

// https://www.novell.com/documentation/extend5/Docs/help/MP/orb/tutorial/poaBankSecure-1.htm

// security context is per thread or per ORB
// class SecurityCurrent {
//     static narrow(obj: CORBAObject): SecurityCurrent {
//         if (obj instanceof SecurityCurrent)
//             return obj
//         throw Error()
//     }

//     /**
//      * Get the port of the remote client
//      */
//     getPort(): number {
//         return 0
//     }

//     getLocalAddress(): string {

//     }

//     getLocalPort(): string {

//     }


//     getSecurityContext() {

//     }

//     // get the SecurityContext of the caller
//     getCaller() {

//     }

//     /**
//      * Set the server side Authenticator to authenticate received InitialContextTokens
//      */
//     setAuthenticator(authenticator: Authenticator) {
//     }

//     /**
//      * Set the client side AuthCallBack to create a security context if none has been set
//      */
//     setAuthCallback(authCallBack: AuthCallBack) {

//     }

//     newContext(): SecurityContext {
//         return new SecurityContext()
//     }

//     setORBContext(ctx: SecurityContext) {       
//     }

//     createInitialContextToken(username: string, password: string, realm: string): InitialContextToken {
//         return new InitialContextToken(username, password, realm)
//     }

// }

// // Username/Password GSSUP

// // The GSS Object Identifier allocated for the username/password mechanism
// // { iso-itu-t (2) international-organization (23) omg (130) security (1) authentication (1) gssup-mechanism (1) }
// const GSSUPMechOID = "oid:2.23.130.1.1.1"

// // The following structure defines the inner contents of the
// // username password initial context token. This structure is
// // CDR encapsulated and appended at the end of the
// // username/password GSS (initial context) Token.

// // CORBA Security Service, v1.8; 3.4.3.1 The Initial Context Token
// // send in an EstablishContext SECIOP message

// // The GSSUP InitialContextToken specifying password credentials for a given user.


// // https://www.novell.com/documentation/extend5/Docs/help/MP/orb/tutorial/
// class SecurityContext {
//     getIdentityToken(realm: string): IdentityToken {
//         throw Error("yikes")
//     }
//     getIdentityTokens() {}

//     getInitialIdentityToken(realm: string) {
//     }

//     getInitialIdentityTokens() {    
//     }

//     setIdentityToken(identityToken: IdentityToken) {
//     }

//     setInitialContextToken(initialContextToken: InitialContextToken) {
//     }
// }

// values match 
enum AuthenticationStatus {
    SUCCESS,
    ERROR_UNSPECIFIED = 1, // error, but server doesn't reveal reason
    ERROR_BADPASSWORD,
    ERROR_NOUSER,
    ERROR_BAD_TARGET
}

// Security Service Specification 1.5, 2.3.3.2 SecurityLevel2::PrincipalAuthenticator Interface
// CORBA::Current -> SecurityLevel1::Current -> SecurityLevel2::Current
// 2.3.7.2 The SecurityLevel1::Current Interface
//   this only adds an get_attributes()
//   the idea is that the application uses this to check who's calling it
// 2.3.7.3 The SecurityLevel2::Current Interface
//   set_credentials(type, list, mode)
//   get_credentials(type)
//
//   target object attribute: received_credentials

// the PrincipalAuthenticator object is to be used on the initiator
// it created a Credentials object and places it on the Current object's own_credentials

// 2.3.9
// When an object is created, it automatically becomes a member of one or more domains,
// and therefore is subject to the security policies of those domains.
// 2.3.10 Access Control

/**
 * Server side callback for Authentication and Trust evaluation.
 */

// abstract class Authenticator {

//     /**
//      * Authenticate the username, password, realm contained in the given token.
//      * @param initialContextToken 
//      */
//     abstract authenticate(initialContextToken: InitialContextToken): AuthenticationStatus

//     /**
//      * Evaluate trust in the given IdentityToken. The Authenticator can use the SecurityCurrent
//      * to determine the IP address and the certificate chain of the caller (if using IIOP/SSL).
//      * @param identityToken - user and realm
//      */
//     abstract assertIdentity(identityToken: IdentityToken): boolean
// }


// interface IdentityToken {
//     getBytes(): ArrayBuffer
//     getRealm(): string
//     getType(): number
//         // ITTAbsent
//         // ITTAnonymous 
//         // ITTDistinguishedName 
//         // ITTPrincipalName
//         // ITTX509CertChain 
//     getUser(): string
// }

describe("access", async function () {

    describe("authentication", function () {
        xit("JacORB SAS", async function () {
            const orb = new ORB()

            // AUTHENTICATION SERVER SIDE
            orb.setAuthenticator( (connection: Connection, credentials: Credentials) => {
                if (credentials instanceof InitialContextToken) {
                    return AuthenticationStatus.SUCCESS;
                }
                return AuthenticationStatus.ERROR_UNSPECIFIED
            })

            // AUTHORIZATION
            // * The ACL restricts access to objects added to the NameService
            // * Before sending or returning an object, the app can check the attributes
            //   to decide whether to send or not to send the object to the peer.
            //   At this point the peer is guaranteed to be successfully authenticated.
            // * In case the object reference is send to the peer, it is added to the ACL.

            // AUTHENTICATION CLIENT SIDE
            // restrict sending credentials only to trusted/listed hosts (?)

            // authorizationToken // list
            // identityToken // one
            // authenticationToken // one
            orb.addCredentials("remotehost", new GSSUPInitialContextToken("user", "password", "remotehost")) 
            //  GSSUP, user, password, target_name

            // what when a connection goes down, is re-established and the ACL?
            // what about life time and garbage collection?
            // orb <-> object adapter <-> session with acl <-> connection
            // ...
            // safe the acl? indicate that the object needs to be fetched again?
            // oh oh... things are getting messy...
            // start thinking from the application perspective. how'd you do that without corba.js?
            // persist object and object keys... things are getting even messier...
            // => concentrate on workflow 1st, corba.js 2nd

            const tcp = new TcpProtocol()
            orb.addProtocol(tcp)
            tcp.listen(orb, "0.0.0.0", 8080)

            const servant = new SASDemo_impl(orb)
            orb.bind("Server", servant)
        })
    })

    describe("authorization", function () {

        xit("bind", async function () {

            // setup server
            let serverORB = new ORB()

            let serverA = new Server_impl(serverORB, "A")
            let serverB = new Server_impl(serverORB, "B")

            serverORB.bind("ServerA", serverA)

            // setup client A
            let clientA = new ORB()
            clientA.registerStubClass(stub.Server)

            // // server side
            // const securityServerA = SecurityCurrent.narrow(serverA.resolveInitialReferences("SecurityCurrent"))
            // securityServerA.setAuthenticator(new class extends Authenticator {
            //     override authenticate(initialContextToken: InitialContextToken) {
            //         return AuthenticationStatus.SUCCESS
            //     }
            //     override assertIdentity(identityToken: IdentityToken): boolean {
            //         return true
            //     }
            // }())
            // const poa = POA.narrow(serverA.resolve_initial_references("RootPOA"))
            // // set poa policy to IdAssignmentPolicyValue.USER_ID

            // // client side
            // const securityClientA = SecurityCurrent.narrow(clientA.resolveInitialReferences("SecurityCurrent"))
            // const securityContext = securityClientA.newContext()
            // securityContext.setInitialContextToken(securityClientA.createInitialContextToken("user", "password", "192.168.1.1"))
            // securityClientA.setORBContext(securityContext)

            mockConnection(serverORB, clientA)

            let objectA = await clientA.resolve("ServerA")
            let serverStub = stub.Server.narrow(objectA)

            // object published with bind can be accessed
            serverA.wasCalled = false
            serverB.wasCalled = false
            serverStub.call()
            expect(serverA.wasCalled).to.equal(true)
            expect(serverB.wasCalled).to.equal(false);

            (serverStub as any).id = (serverB as any).id

            // object not published with bind can not be accessed
            serverA.wasCalled = false
            serverB.wasCalled = false
            serverStub.call()
            expect(serverA.wasCalled).to.equal(false)
            expect(serverB.wasCalled).to.equal(false)

            serverORB.bind("ServerB", serverB)

            // object not resolved with resolve can not be accessed
            serverA.wasCalled = false
            serverB.wasCalled = false
            serverStub.call()
            expect(serverA.wasCalled).to.equal(false)
            expect(serverB.wasCalled).to.equal(false)

            // check the validity of the tweaked serverStub.id
            await clientA.resolve("ServerB")

            serverA.wasCalled = false
            serverB.wasCalled = false
            serverStub.call()
            expect(serverA.wasCalled).to.equal(false)
            expect(serverB.wasCalled).to.equal(true)
        })

        xit("object send to server", async function () {

            // setup server
            let serverORB = new ORB()

            let serverImpl = new Server_impl(serverORB, "S")

            serverORB.bind("Server", serverImpl)
            serverORB.registerStubClass(stub.Listener)

            // setup client A
            let clientA = new ORB()
            clientA.registerStubClass(stub.Server)
            let connectionA = mockConnection(serverORB, clientA)
            let serverStub = stub.Server.narrow(await clientA.resolve("Server"))
            let objectA = new Listener_impl(clientA, "A")
            let objectB = new Listener_impl(clientA, "B")
            //connectionA.debug = 1
            //clientA.debug = 1
            await serverStub.set(objectA)

            expect(serverImpl.listener.get("A")).not.to.equal(undefined)
            let objectAStub = serverImpl.listener.get("A") as stub.Listener

            // make a legal call to the client
            objectA.wasCalled = false
            await objectAStub!.call()
            expect(objectA.wasCalled).to.equal(true);

            // make an illegal call to the client
            (objectAStub as any).id = (objectB as any).id

            objectA.wasCalled = false
            objectB.wasCalled = false
            let error: any = undefined
            try {
                await objectAStub!.call()
            }
            catch (caughtError) {
                error = caughtError
            }
            expect(error).to.be.an.instanceof(Error)
            expect(error.message).to.equal("ORB.handleMethod(): client required method 'call' on server but has no rights to access servant with id 2")
            expect(objectA.wasCalled).to.equal(false)
            expect(objectB.wasCalled).to.equal(false)

            // make the tweaked stub legal
            await serverStub.set(objectB)

            // make a legal call to the client
            objectA.wasCalled = false
            objectB.wasCalled = false
            await objectAStub!.call()
            expect(objectA.wasCalled).to.equal(false)
            expect(objectB.wasCalled).to.equal(true)
        })

        xit("object received from server", async function () {

            // setup server
            let serverORB = new ORB()

            let serverImpl = new Server_impl(serverORB, "S")
            let objectA = new Listener_impl(serverORB, "A")
            let objectB = new Listener_impl(serverORB, "B")
            serverImpl.set(objectA)
            serverImpl.set(objectB)

            serverORB.bind("Server", serverImpl)

            // setup client A
            let clientA = new ORB()
            clientA.registerStubClass(stub.Server)
            clientA.registerStubClass(stub.Listener)
            let connectionA = mockConnection(serverORB, clientA)
            let serverStub = stub.Server.narrow(await clientA.resolve("Server"))

            let objectAStub = (await serverStub.get("A") as any) as skel.Listener

            // make a legal call to the server
            objectA.wasCalled = false
            await objectAStub!.call()
            expect(objectA.wasCalled).to.equal(true);

            // make an illegal call to the client
            (objectAStub as any).id = (objectB as any).id

            objectA.wasCalled = false
            objectB.wasCalled = false
            let error: any = undefined
            try {
                await objectAStub!.call()
            }
            catch (caughtError) {
                error = caughtError
            }
            expect(objectA.wasCalled).to.equal(false)
            expect(objectB.wasCalled).to.equal(false)

            expect(error).to.be.an.instanceof(Error)
            expect(error.message).to.equal("ORB.handleMethod(): client required method 'call' on server but has no rights to access servant with id 3")

            // make the tweaked stub legal
            let objectBStub = await serverStub.get("B")

            // make a legal call to the server
            objectA.wasCalled = false
            objectB.wasCalled = false
            await objectAStub!.call()
            expect(objectA.wasCalled).to.equal(false)
            expect(objectB.wasCalled).to.equal(true)
        })
    })
})

class SASDemo_impl extends skel.org.jacorb.demo.sas.SASDemo {
    async printSAS() {
        console.log("===============> printSAS")
    }
    async shutdown() {
        console.log("===============> shutdown")
    }
}

class Server_impl extends skel.Server {
    name: string
    wasCalled: boolean
    listener: Map<string, iface.Listener>

    constructor(orb: ORB, name: string) {
        super(orb)
        this.name = name
        this.wasCalled = false
        this.listener = new Map<string, iface.Listener>()
    }

    async call() {
        // this.name = "XXX"
        this.wasCalled = true
        return 0
    }

    async set(listener: skel.Listener) {
        let name = await listener.getName()
        this.listener.set(name, listener)
        return 0
    }

    async get(name: string) {
        return this.listener.get(name) as skel.Listener
    }
}

class Listener_impl extends skel.Listener {
    name: string
    wasCalled: boolean

    constructor(orb: ORB, name: string) {
        super(orb)
        this.name = name
        this.wasCalled = false
    }

    async getName() {
        return this.name
    }

    async call() {
        // this.name = name
        this.wasCalled = true
        return 0
    }
}
