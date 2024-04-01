/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2021, 2024 Mark-André Hopf <mhopf@mark13.org>
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

import { CORBAObject, ORB, Stub, Skeleton, ValueTypeInformation } from "./orb"
import { IOR } from "./ior"
import { Connection } from "./connection"
import { ASN1Tag, ASN1Encoding, ASN1Class, ASN1UniversalTag } from "./asn1"
import { CompletionStatus, OBJECT_ADAPTER } from "./orb"

// 9.4 GIOP Message Formats
export enum MessageType {
    REQUEST = 0,
    REPLY = 1,
    CANCEL_REQUEST = 2,
    LOCATE_REQUEST = 3,
    LOCATE_REPLY = 4,
    CLOSE_CONNECTION = 5,
    MESSAGE_ERROR = 6,
    FRAGMENT = 7,
}

// IOR Tag
export enum TagType {
    ORB_TYPE = 0,
    CODE_SETS = 1,
    POLICIES = 2,
    ALTERNATE_IIOP_ADDRESS = 3,

    // chaos starts below...
    // some of these tag's might not be on top level but only within CSI_SEC_MECH_LIST?
    ASSOCIATION_OPTIONS = 13,
    SEC_NAME = 14, // security name to identify the target

    SPKM_1_SEC_MECH = 15,
    SPKM_2_SEC_MECH = 16,
    KerberosV5_SEC_MECH = 17,
    CSI_ECMA_Secret_SEC_MECH = 18,
    CSI_ECMA_Hybrid_SEC_MECH = 19,
    CSI_ECMA_Public_SEC_MECH = 21,
    GENERIC_SEC_MECH = 22, // mechanisms not registered with OMG identified using ASN.1 OIDs

    // there is SECIOP and SSL/TLS

    CSI_SEC_MECH_LIST = 33,
    // struct CompoundSecMechList {
    //    boolean stateful;
    //    sequence<CompoundSecMech> mechanism_list;
    // };
    // struct CompoundSecMech {
    //     AssociationOptions target_requires;
    //     IOP::TaggedComponent transport_mech;
    //     AS_ContextSec as_context_mech;
    //     SAS_ContextSec sas_context_mech;
    // };

    SSL_SEC_TRANS = 10,
    // struct SSL {
    //     Security::AssociationOptions target_supports;
    //     Security::AssociationOptions target_requires;
    //     unsigned short prototype;
    // };

    TLS_SEC_TRANS = 36,
    // within TAG_CSI_SEC_MECH_LIST
    // struct TLS_SEC_TRANS {
    //     AssociationOptions target_supports;
    //     AssociationOptions target_requires;
    //     TransportAddressList addresses;
    // };

    IIOP_SEC_TRANS = 43,
    INET_SEC_TRANS = 123, // aka SECIOP_INET_SEC_TRANS
    // struct SECIOP_INET_SEC_TRANS {
    //     unsigned short port;
    // };

    SECIOP_SEC_TRANS = 35,
    // within TAG_CSI_SEC_MECH_LIST
    // use SECIOP underneath CSI
    // struct SECIOP_SEC_TRANS {
    //     AssociationOptions target_supports;
    //     AssociationOptions target_requires;
    //     CSI::OID mech_oid;
    //     CSI::GSS_NT_ExportedName target_name;
    //     TransportAddressList addresses;
    // };

    FIREWALL_TRANS = 13,
    PASSTHRU_TRANS = 41,

    FIREWALL_PATH = 42,

    SCCP_CONTACT_INFO = 14,
    JAVA_CODEBASE = 15,
    TRANSACTION_POLICY = 16,
    MESSAGE_ROUTERS = 30,
    OTS_POLICY = 31,
    INV_POLICY = 32,
    TAG_NULL_TAG = 34,
    ACTIVITY_POLICY = 37,
    RMI_CUSTOM_MAX_STREAM_FORMAT = 38,
    GROUP = 39,
    GROUP_IIOP = 40,
}

// Component
export enum ServiceId {
    TransactionService = 0,
    CodeSets = 1,
    ChainBypassCheck = 2,
    ChainBypassInfo = 3,
    LogicalThreadId = 4,
    BI_DIR_IIOP = 5,
    SendingContextRunTime = 6,
    INVOCATION_POLICIES = 7,
    FORWARDED_IDENTITY = 8,
    UnknownExceptionInfo = 9,
    RTCorbaPriority = 10,
    RTCorbaPriorityRange = 11,
    FT_GROUP_VERSION = 12,
    FT_REQUEST = 13,
    ExceptionDetailMessage = 14,
    SecurityAttributeService = 15, // CSIv2
    ActivityService = 16,
    RMICustomMaxStreamFormat = 17,
    ACCESS_SESSION_ID = 18,
    SERVICE_SESSION_ID = 19,
    FIREWALL_PATH = 20,
    FIREWALL_PATH_RESP = 21,

    // JacORB uses this as the last context to fill to an 8 byte boundary
    SERVICE_PADDING_CONTEXT = 0x4a414301, // "JAC\01"
}

// 10.2.2 SAS context_data Message Body Types
enum SASType {
    EstablishContext,
    CompleteEstablishContext,
    ContextError,

    // Not sent by stateless clients. If received by a stateless server, a
    // ContextError message should be returned, indicating the session does
    // not exist.
    MessageInContext,
}

export class AuthorizationToken {
    type: number
    content: Uint8Array
    constructor(type: number, content: Uint8Array) {
        this.type = type
        this.content = content
    }
}

export class GSSUPInitialContextToken {
    user: string
    password: string
    target_name: string
    constructor(user: string, password: string, target_name: string) {
        this.user = user
        this.password = password
        this.target_name = target_name
    }
}

export class SecurityContext {}

export class EstablishContext extends SecurityContext {
    clientContextId = 0n
    authorizationToken: any[] = []
    identityToken: any
    clientAuthenticationToken: any // GSSToken

    decode(decoder: GIOPDecoder) {
        this.clientContextId = decoder.ulonglong()
        // console.log(`  clientContextId = ${context.clientContextId}`)

        // console.log(`octets left: ${this.encapStack[this.encapStack.length - 1].nextOffset - this.offset}`)
        if (decoder.encapStack[decoder.encapStack.length - 1].nextOffset - decoder.offset < 4) {
            // console.log(`use previously negotiated context (?)`)
            return
        }

        // bearer tokens for further authorization (e.g. a JWT)
        const authorizationTokenCount = decoder.ulong()
        // console.log(`  authorizationTokenLength=${authorizationTokenCount}`)
        for (let i = 0; i < authorizationTokenCount; ++i) {
            const type = decoder.ulong()
            // const vendorMinorCodeSetId = type >> 20
            // const typeIdentifier = type & 0xfffff
            const content = decoder.blob()
            this.authorizationToken.push(new AuthorizationToken(type, content))
        }

        // if given, use this identity instead of the one from the authentication layer
        const tokenType = decoder.ulong()
        // console.log(`  tokenType=${IdentityTokenType[tokenType]}`)
        switch (tokenType) {
            case IdentityTokenType.Absent:
                {
                    const absent = decoder.bool()
                    // console.log(`    Absent = ${absent}`)
                }
                break
            default: {
                // console.log(`Can not authenticate client: CSIv2 tokenType=${IdentityTokenType[tokenType]} not supported.`)
            }
        }

        // The Generic Security Service (GSS) defined in RFC 2743 and 2743 provides an
        // API between a network protocol implementation and an authentication framework.
        // Each authentication mechanism is identified with an OID
        //
        // Kerberos
        //   1.2.840.113554.1.2.2     Kerberos v5 (RFC 1964)
        //   1.2.840.113554.1.2.2.3   Kerberos v5 user to user
        //   1.2.840.48018.1.2.2      Kerberos v5 (MS Windows Bug, 48018 == 113554 & 0xFFFF)
        // Microsoft
        //   1.2.752.43.14.2          NETLOGON
        //   1.3.6.1.5.5.2            SPNEGO (RFC 4178)
        //   1.3.6.1.5.2.5            IAKERB (draft-ietf-kitten-iakerb-03)
        //   1.3.6.1.4.1.311.2.2.10   NTLM SSP
        //   1.3.6.1.4.1.311.2.2.30   NEGOEX
        // Salted Challenge Response Authentication Mechanism
        //   1.3.6.1.5.5.14           SCRAM-SHA-1 (RFC 5802)
        //   1.3.6.1.5.5.18           SCRAM-SHA-256 (RFC 7677)
        // Extensible Authentication Protocol
        //   1.3.6.1.5.5.15.1.1.*     GSS-EAP (arc) (RFC 7055)
        //   1.3.6.1.5.2.7            PKU2U – draft-zhu-pku2u-09
        // Simple Public Key Mechanism
        //   1.3.6.1.5.5.1.1          SPKM-1 (RFC 2025)
        //   1.3.6.1.5.5.1.2          SPKM-2 (RFC 2025)
        //   1.3.6.1.5.5.1.3          SPKM-3 (RFC 2847)
        // Low Infrastructure Public Key Mechanism Using SPKM
        //   1.3.6.1.5.5.9            LIPKEY (RFC 2847)
        // OMG
        //   2.23.130.1.1.1           CORBA Username Password (GSSUP)

        // authentication
        const blobLength = decoder.ulong()
        // console.log(`  authentication length = ${blobLength}`)

        // CORBA 3.4, Part 2, 10.2.4.1.1 GSSUP Initial Context Token
        //
        // The format of a GSSUP initial context token shall be as defined in
        // [IETF RFC 2743] 3.1, “Mechanism-Independent Token Format,” pp. 81-82.
        // RFC 2744 is the GSS C API, it's intended to be between the protocol (e.g. IIOP)
        // and the security mechanism (eg. Kerberos, JWT, ...)
        //
        // This GSSToken shall contain an ASN.1 tag followed by a token length, ...
        if (decoder.asn1expect(ASN1Class.APPLICATION, 0, ASN1Encoding.CONSTRUCTED) === undefined) return

        // ... an authentication mechanism identifier, and ...
        // Generic Security Service User Password (GSSUP)
        // {iso-itu-t(2) international-organization(23) omg(130) security(1) authentication(1) gssup-mechanism(1)}

        if (!decoder.asn1expectOID([2, 23, 130, 1, 1, 1])) return

        // ... a CDR encapsulation containing a GSSUP inner context token as defined by the type GSSUP::InitialContextToken
        const cdr = new GIOPDecoder(decoder.buffer.slice(decoder.offset))
        cdr.endian()
        const te = new TextDecoder()

        this.clientAuthenticationToken = new GSSUPInitialContextToken(
            te.decode(cdr.blob()),
            te.decode(cdr.blob()),
            te.decode(cdr.blob())
        )
    }
}

// COBRA 3.3 part 2, 10.2.2.2
// send along with a NO_PERMISSION exception
// 10.3.5 ContextError Values and Exceptions
export class ContextError extends SecurityContext {
    clientContextId = 0n
    majorStatus: number = 1
    minorStatus: number = 1
    errorToken: any // GSSToken
}

// COBRA 3.3 part 2, 10.2.2.3
export class CompleteEstablishContext extends SecurityContext {
    clientContextId = 0n
    contextStateful!: boolean
    finalContextToken: any // GSSToken
}

export enum AuthenticationStatus {
    SUCCESS,
    ERROR_UNSPECIFIED = 1, // error, but server doesn't reveal reason
    ERROR_BADPASSWORD,
    ERROR_NOUSER,
    ERROR_BAD_TARGET,
}

enum IdentityTokenType {
    // Identity token is absent; the message conveys no representation of identity assertion.
    Absent = 0,
    // Identity token is being used to assert a valueless representation of an unauthenticated caller.
    Anonymous = 1,
    // Identity token contains an octet stream containing a GSS mechanism-independent exported name object as defined in [IETF RFC 2743].
    PrincipalName = 2,
    // Identity token contains an octet stream containing an ASN.1 encoding of a chain of X.509 identity certificates.
    X509CertChain = 4,
    // Identity token contains an octet stream containing an ASN.1 encoding of an X.501 distinguished name.
    DistinguishedName = 8,
}

export enum AddressingDisposition {
    KeyAddr = 0,
    ProfileAddr = 1,
    ReferenceAddr = 2,
}

export enum ReplyStatus {
    NO_EXCEPTION = 0,
    USER_EXCEPTION = 1,
    SYSTEM_EXCEPTION = 2,
    LOCATION_FORWARD = 3,
    // since GIOP 1.2
    LOCATION_FORWARD_PERM = 4,
    NEEDS_ADDRESSING_MODE = 5,
}

export class BidirectionalIIOPServiceContext {
    host!: string
    port!: number
}

export class RequestData {
    requestId!: number
    responseExpected!: boolean
    objectKey!: Uint8Array
    method!: string
    error?: Error

    serviceContext!: any[]
}

class ReplyData {
    requestId!: number
    replyStatus!: ReplyStatus
}

class LocateRequest {
    requestId!: number
    objectKey!: Uint8Array
}

export enum LocateStatusType {
    UNKNOWN_OBJECT = 0,
    OBJECT_HERE = 1,
    OBJECT_FORWARD = 2,
    // GIOP >= 1.2
    OBJECT_FORWARD_PERM = 3,
    LOC_SYSTEM_EXCEPTION = 4,
    LOC_NEEDS_ADDRESSING_MODE = 5,
}

class LocateReply {
    requestId!: number
    status!: LocateStatusType
}

export class ObjectReference {
    oid!: string
    host!: string
    port!: number
    objectKey!: Uint8Array
    toString(): string {
        return `ObjectReference(oid=${this.oid}, host=${this.host}, port=${this.port}, objectKey=${this.objectKey}')`
    }
}

export class GIOPBase {
    offset = 0

    majorVersion = 1
    minorVersion = 2

    // TODO: get rid of these, this is the encoding on the wire, let endian() handle it
    static ENDIAN_BIG = 0
    static ENDIAN_LITTLE = 1

    static FLOAT64_MAX = 1.7976931348623157e308
    static FLOAT64_MIN = 2.2250738585072014e-308
    static TWO_TO_20 = 1048576
    static TWO_TO_32 = 4294967296
    static TWO_TO_52 = 4503599627370496

    connection?: Connection
    constructor(connection?: Connection) {
        this.connection = connection
    }
}

export class GIOPEncoder extends GIOPBase {
    buffer = new ArrayBuffer(0xffff)
    data = new DataView(this.buffer)
    bytes = new Uint8Array(this.buffer)

    public static textEncoder = new TextEncoder()

    // this is the parameter as used for the DataView
    static littleEndian?: boolean

    protected repositoryIds = new Map<string, number>()
    protected objectPosition = new Map<Object, number>()

    constructor(connection?: Connection) {
        super(connection)
        // use this system's endianes
        if (GIOPEncoder.littleEndian === undefined) {
            const buffer = new ArrayBuffer(2)
            new Int16Array(buffer)[0] = 0x1234
            GIOPEncoder.littleEndian = new DataView(buffer).getUint8(0) === 0x34
        }
    }

    get buf() {
        return this.buffer
    }

    // CDR

    sizeStack: number[] = []

    // FIXME: find better names and use them everywhere
    reserveSize() {
        this.alignAndReserve(4)
        this.offset += 4
        this.sizeStack.push(this.offset)
    }

    fillinSize() {
        const currrentOffset = this.offset
        const savedOffset = this.sizeStack.pop()
        if (savedOffset === undefined) throw Error(`internal error: fillinSize() misses reserveSize()`)
        this.offset = savedOffset - 4
        const size = currrentOffset - savedOffset
        this.ulong(size)
        this.offset = currrentOffset
    }

    // CORBA 3.4 Part 2, 9.3.3 Encapsulation
    // Used for ServiceContext, Profile and Component
    beginEncapsulation(type: number) {
        this.ulong(type)
        this.reserveSize()
        this.endian()
    }

    endEncapsulation() {
        this.fillinSize()
    }

    // GIOP

    // TODO: remove as we now have reserveSize()/fillinSize()
    skipGIOPHeader() {
        this.offset = 10
    }

    // TODO: remove as we now have reserveSize()/fillinSize()
    // this is the last method to be called as it also set's the GIOP messsages size
    // from the already encoded data
    setGIOPHeader(type: MessageType) {
        this.data.setUint32(0, 0x47494f50) // magic "GIOP"

        this.data.setUint8(4, this.majorVersion)
        this.data.setUint8(5, this.minorVersion)
        this.data.setUint8(6, GIOPEncoder.littleEndian ? GIOPBase.ENDIAN_LITTLE : GIOPBase.ENDIAN_BIG)
        this.data.setUint8(7, type)

        // message size
        this.data.setUint32(8, this.offset - 12, GIOPEncoder.littleEndian)
    }

    // additonal operation names b
    // _get_<attribute>
    // _set_<attribute>
    // _interface
    // _is_a
    // _non_existent (additionally _not_existent when using GIOP <= 1.1)
    // _domain_managers
    // _component
    // _repository_id

    encodeRequest(objectKey: Uint8Array, operation: string, requestId = 1, responseExpected: boolean) {
        this.skipGIOPHeader()

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.serviceContext()
        }
        this.ulong(requestId)
        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.octet(responseExpected ? 1 : 0)
        } else {
            this.octet(responseExpected ? 3 : 0)
        }

        this.offset += 3

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.blob(objectKey!)
        } else {
            this.ushort(AddressingDisposition.KeyAddr)
            this.blob(objectKey!)
        }

        this.string(operation)
        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.ulong(0) // Requesting Principal length
        } else {
            this.serviceContext()
            this.alignAndReserve(8)
        }
    }

    encodeReply(requestId: number, replyStatus: number = ReplyStatus.NO_EXCEPTION) {
        this.skipGIOPHeader()
        // fixme: create and use version methods like isVersionLessThan(1,2) or isVersionVersionGreaterEqual(1,2)
        if (this.majorVersion == 1 && this.minorVersion < 2) {
            // this.serviceContext()
            this.ulong(0) // skipReplyHeader needs a fixed size service context
        }
        this.ulong(requestId)
        this.ulong(replyStatus)
        if (this.majorVersion == 1 && this.minorVersion >= 2) {
            // this.serviceContext()
            this.ulong(0) // skipReplyHeader needs a fixed size service context
        }
    }

    encodeLocateReply(requestId: number, status: LocateStatusType) {
        this.skipGIOPHeader()
        this.ulong(requestId)
        this.ulong(status)
    }

    // Corba 3.4 Part 2, 7.7 Service Context
    serviceContext() {
        // TODO: remove this, this happens only in tests
        if (!this.connection) {
            this.ulong(0)
            return
        }

        let count = 1
        let initialToken

        if (this.connection.orb.outgoingAuthenticator) {
            initialToken = this.connection.orb.outgoingAuthenticator(this.connection)
            if (initialToken) {
                ++count
            }
        }

        this.ulong(count) // count

        // CORBA 3.4 Part 2, 9.8.1 Bi-directional IIOP Service Context
        // TODO: send listen point only once per connection
        this.beginEncapsulation(ServiceId.BI_DIR_IIOP)
        this.ulong(1) // number of listen points
        this.string(this.connection!.localAddress)
        this.ushort(this.connection!.localPort)
        this.endEncapsulation()

        if (initialToken) {
            this.establishSecurityContext(initialToken)
        }

        /*
        this.beginEncapsulation(ServiceId.CodeSets)
        // this.ulong(0x00010001) // ISO-8859-1
        this.ulong(0x05010001) // charset_id : UTF-8
        this.ulong(0x00010109) // wcharset_id: UTF-16
        this.endEncapsulation()
        */
    }

    // CORBA 3.4 Part 2, page 176
    establishSecurityContext(initialToken: GSSUPInitialContextToken) {
        this.beginEncapsulation(ServiceId.SecurityAttributeService)
        this.ulong(SASType.EstablishContext)

        // ContextId client_context_id;
        this.ulonglong(1n)

        // sequence<AuthorizationToken>;
        this.ulong(0) // empty sequence

        // IdentityToken identity_token;
        this.ulong(IdentityTokenType.Absent)
        this.bool(true)

        this.reserveSize()

        // GSSUP :={ iso-itu-t (2) international-organization (23) omg (130) security (1) authentication (1) gssup-mechanism (1) }
        this.asn1tag(ASN1Class.APPLICATION, 0, ASN1Encoding.CONSTRUCTED, (encoder) => {
            encoder.asn1tag(ASN1Class.UNIVERSAL, ASN1UniversalTag.OID, ASN1Encoding.PRIMITIVE, (encoder) => {
                encoder.asn1oid([2, 23, 130, 1, 1, 1])
            })

            encoder.endian()
            const te = new TextEncoder()
            encoder.blob(te.encode(initialToken.user))
            encoder.blob(te.encode(initialToken.password))
            encoder.blob(te.encode(initialToken.target_name))
        })
        this.fillinSize()

        this.endEncapsulation()
    }

    // TODO: remove as we now have reserveSize()/fillinSize()
    // FIXME: rename into ...?
    setReplyHeader(requestId: number, replyStatus: number = ReplyStatus.NO_EXCEPTION) {
        this.skipGIOPHeader()
        this.encodeReply(requestId, replyStatus)
    }

    // FIXME: rename into ...?
    skipReplyHeader() {
        this.offset = 24 // this does not work!!! anymore with having a variable length service context!!!
    }

    repositoryId(name: string) {
        // * "IDL:" indicates that the type was defined in an IDL file
        // * ":1.0" is the types version. 1.0 is used per default
        // * in the IDL, #pragma version (CORBA 3.4 Part 1, 14.7.5.3 The Version Pragma) can be used to specify other versions
        //   * TBD: describe how to use versioning
        // * in the IDL, #pragma prefix can be used to add a prefix to the name.
        // * See also: CORBA Part 2, 9.3.4.1 Partial Type Information and Versioning
        const id = `IDL:${name}:1.0`

        const position = this.repositoryIds.get(id)
        if (position === undefined) {
            // console.log(`GIOPDecoder.repositoryId(): at 0x${this.offset.toString(16)} writing repository ID '${id}' at 0x${this.offset.toString(16)}`)
            this.ulong(0x7fffff02) // single repositoryId
            this.repositoryIds.set(id, this.offset)
            this.string(id)
        } else {
            // 9.3.4.3
            // console.log(`GIOPDecoder.repositoryId(): at 0x${this.offset.toString(16)} writing indirect repository ID '${id}' indirection ${indirection} pointing to 0x${position.toString(16)}`)
            this.ulong(0x7fffff02) // single repositoryId
            this.ulong(0xffffffff)
            this.long(position - this.offset)
        }
    }

    // Interoperable Object Reference (IOR)
    reference(object: CORBAObject) {
        const className = (object.constructor as any)._idlClassName()

        const reference = new ObjectReference()
        reference.host = this.connection!.localAddress
        reference.port = this.connection!.localPort
        reference.oid = `IDL:${className}:1.0`
        reference.objectKey = object.id

        // type id
        this.string(reference.oid)

        // tagged profile sequence
        this.ulong(1) // profileCount

        // profile id
        // 9.7.2 IIOP IOR Profiles
        this.ulong(IOR.TAG.IOR.INTERNET_IOP)
        this.reserveSize()
        this.endian()
        this.octet(this.majorVersion)
        this.octet(this.minorVersion)

        // FIXME: the object should know where it is located, at least, if it's a stub, skeleton is local
        this.string(reference.host)
        this.ushort(reference.port)
        this.blob(reference.objectKey)

        // IIOP >= 1.1: components
        if (this.majorVersion != 1 || this.minorVersion != 0) {
            // this.ulong(0)
            this.ulong(1) // component count = 1
            this.beginEncapsulation(0) // TAG_ORB_TYPE (3.4 P 2, 7.6.6.1)
            this.ulong(0x4d313300) // "M13\0" as ORB Type ID for corba.js
            this.endEncapsulation()
        }
        this.fillinSize()
    }

    value(object: Object | undefined) {
        this.object(object)
    }

    object(object: Object | undefined) {
        // if (object) {
        //     console.log(`GIOPEncoder.object(${object.constructor.name}) offset=0x${this.offset.toString(16)}`)
        // } else {
        //     console.log(`GIOPEncoder.object(undefined)`)
        // }

        if (object === undefined) {
            this.ulong(0)
            return
        }

        // console.log(`GIOPEncoder.object(): WRITE OBJECT AT 0x${(this.offset - 4).toString(16)}`)

        if (object instanceof Stub) {
            throw Error("ORB: can not serialize Stub yet")
        }

        if (object instanceof Skeleton) {
            if (this.connection === undefined) {
                throw Error("GIOPEncoder has no connection defined. Can not add object to ACL.")
            }
            this.connection.orb.aclAdd(object)
            this.reference(object)
            return
        }

        const position = this.objectPosition.get(object)
        if (position !== undefined) {
            // console.log(`GIOPEncoder.object(): at 0x${this.offset.toString(16)} write object indirection ${indirection} pointing to 0x${position.toString(16)}`)
            this.ulong(0xffffffff)
            this.long(position - this.offset)
            return
        }

        let prototype = Object.getPrototypeOf(object)
        let valueTypeInformation: ValueTypeInformation | undefined
        while (prototype !== null) {
            valueTypeInformation = ORB.valueTypeByPrototype.get(prototype)
            if (valueTypeInformation !== undefined) {
                break
            }
            prototype = Object.getPrototypeOf(prototype) // ???
        }

        if (valueTypeInformation === undefined) {
            throw Error(`ORB: can not serialize object of unregistered valuetype ${object.constructor.name}`)
        }

        if ((valueTypeInformation?.construct as any).name !== object.constructor.name) {
            throw Error(
                `ORB: No value type registered for class ${object.constructor.name}. Best match was class ${
                    (valueTypeInformation?.construct as any).name
                }.`
            )
        }

        this.alignAndReserve(4)
        this.objectPosition.set(object, this.offset)
        this.repositoryId(valueTypeInformation.name!)
        valueTypeInformation.encode(this, object)
    }

    endian() {
        this.octet(GIOPEncoder.littleEndian ? GIOPBase.ENDIAN_LITTLE : GIOPBase.ENDIAN_BIG)
    }

    reserveOne() {
        if (this.buffer.byteLength <= this.offset + 1) {
            const bufferNew = new ArrayBuffer(this.buffer.byteLength * 2)
            new Uint8Array(bufferNew).set(new Uint8Array(this.buffer))
            this.buffer = bufferNew
            this.data = new DataView(this.buffer)
            this.bytes = new Uint8Array(this.buffer)
        }
    }

    /**
     * Align at to and reserve 'align' octets
     */
    alignAndReserve(align: number) {
        this.alignAndReserveVarying(align, align)
    }

    /**
     * Align to 'align' and reserve 'nbytes' octets
     */
    alignAndReserveVarying(align: number, nbytes: number) {
        // align offset to 'align'
        // TODO: what we actually want to do is the IDL compiler figuring this out (unless we're after a variable length item)
        // also: not sure if the bit logic really improves performance in javascript
        switch (align) {
            case 1:
                break
            case 2:
                if (this.offset & 0x01) {
                    ++this.offset
                }
                break
            case 4:
                if (this.offset & 0x03) {
                    this.offset |= 0x03
                    ++this.offset
                }
                break
            case 8:
                if (this.offset & 0x07) {
                    this.offset |= 0x07
                    ++this.offset
                }
                break
            default:
                throw Error(`alignment to ${align} bytes is not implemented`)
        }

        if (this.buffer.byteLength <= this.offset + nbytes) {
            // double buffer size until we have enough room for additional nbytes
            let newLength = this.buffer.byteLength
            while (newLength <= this.offset + nbytes) {
                newLength *= 2
            }
            // allocate the new buffer size
            const bufferNew = new ArrayBuffer(newLength)
            new Uint8Array(bufferNew).set(new Uint8Array(this.buffer))
            this.buffer = bufferNew
            this.data = new DataView(this.buffer)
            this.bytes = new Uint8Array(this.buffer)
        }
    }

    blob(value: Uint8Array) {
        this.alignAndReserveVarying(4, 4 + value.length)
        this.ulong(value.length)
        this.bytes.set(value, this.offset)
        this.offset += value.length
    }

    string(value: string) {
        const octets = GIOPEncoder.textEncoder.encode(value)
        this.alignAndReserveVarying(4, 4 + octets.length + 1)
        this.ulong(octets.length + 1)
        this.bytes.set(octets, this.offset)
        this.offset += octets.length
        this.bytes[this.offset] = 0
        this.offset++
    }

    sequence<T>(array: T[], encodeItem: (a: T) => void) {
        this.ulong(array.length)
        array.forEach((value) => {
            encodeItem(value)
        })
    }

    sequenceOctet(value: Uint8Array) {
        this.ulong(value.length)
        const nbytes = value.length
        this.alignAndReserveVarying(4, nbytes)
        const buffer = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + nbytes))
        this.bytes.set(buffer, this.offset)
        this.offset += nbytes
    }

    sequenceFloat(value: Float32Array) {
        this.ulong(value.length)
        const nbytes = value.length * 4
        this.alignAndReserveVarying(4, nbytes)
        const buffer = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + nbytes))
        this.bytes.set(buffer, this.offset)
        this.offset += nbytes
    }

    sequenceDouble(value: Float64Array) {
        const nbytes = value.length * 8
        this.ulong(value.length)
        this.alignAndReserveVarying(8, nbytes)
        const buffer = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + nbytes))
        this.bytes.set(buffer, this.offset)
        this.offset += nbytes
    }

    bool(value: boolean) {
        this.reserveOne()
        this.data.setUint8(this.offset, value ? 1 : 0)
        this.offset += 1
    }

    char(value: string) {
        this.reserveOne()
        this.data.setUint8(this.offset, value.charCodeAt(0))
        this.offset += 1
    }

    octet(value: number) {
        this.reserveOne()
        this.data.setUint8(this.offset, value)
        this.offset += 1
    }

    short(value: number) {
        this.alignAndReserve(2)
        this.data.setInt16(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 2
    }

    ushort(value: number) {
        this.alignAndReserve(2)
        this.data.setUint16(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 2
    }

    long(value: number) {
        this.alignAndReserve(4)
        this.data.setInt32(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 4
    }

    ulong(value: number) {
        this.alignAndReserve(4)
        this.data.setUint32(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 4
    }

    longlong(value: bigint) {
        this.alignAndReserve(8)
        this.data.setBigInt64(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 8
    }

    ulonglong(value: bigint) {
        this.alignAndReserve(8)
        this.data.setBigUint64(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 8
    }

    float(value: number) {
        this.alignAndReserve(4)
        this.data.setFloat32(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 4
    }

    double(value: number) {
        this.alignAndReserve(8)
        this.data.setFloat64(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 8
    }

    // ASN.1 uses two different octet stream based encodings for numbers:
    // implicit length for smaller numbers
    // * encoding: most to least significant septet
    // * length: most significant bit of octet of zero indicates last septet
    asn1number(n: number) {
        let out: number[] = []
        while (n > 0x7f) {
            out.push(n & 0x7f)
            n >>= 7
        }
        out.push(n)
        for (let i = out.length - 1; i > 0; --i) {
            this.octet(out[i] | 0x80)
        }
        this.octet(out[0])
    }

    // number with explicit length for larger numbers
    // * encoding: most to least significant octet
    // * length is known
    asn1numberE(n: number) {
        let out: number[] = []
        while (n > 0) {
            out.push(n & 0xff)
            n >>= 8
        }
        this.octet(out.length)
        for (let i = out.length - 1; i >= 0; --i) {
            this.octet(out[i])
        }
    }

    asn1tag(tagClass: number, tag: number, encoding: number, sub: ((encoder: GIOPEncoder) => void) | undefined) {
        const c = (tagClass << 6) | (encoding << 5)
        if (tag < 0x1f) {
            this.octet(c | tag)
        } else {
            this.octet(c | 0x1f)
            this.asn1number(tag)
        }
        const subencoder = new GIOPEncoder()
        if (sub !== undefined) {
            sub(subencoder)
        }
        this.asn1number(subencoder.offset)
        for (let i = 0; i < subencoder.offset; ++i) {
            this.octet(subencoder.bytes[i])
        }
    }

    asn1oid(oid: number[]) {
        this.octet(oid[0] * 40 + oid[1])
        for (let i = 2; i < oid.length; ++i) {
            this.asn1number(oid[i])
        }
    }
}

export class GIOPDecoder extends GIOPBase {
    buffer: ArrayBuffer
    data: DataView
    bytes: Uint8Array

    type!: MessageType
    length!: number
    littleEndian = true

    // FIXME: make protected
    public objects = new Map<number, Object>()

    protected static textDecoder = new TextDecoder()

    constructor(buffer: ArrayBuffer, connection?: Connection) {
        super(connection)
        this.buffer = buffer
        this.data = new DataView(buffer)
        this.bytes = new Uint8Array(buffer)
        // hexdump(this.bytes)
    }

    encapStack: { nextOffset: number; endian: boolean }[] = []

    // CORBA 3.4 Part 2, 9.3.3 Encapsulation
    // Used for ServiceContext, Profile and Component
    beginEncapsulation(): number {
        const type = this.ulong()
        const size = this.ulong()
        const nextOffset = this.offset + size
        this.encapStack.push({
            nextOffset,
            endian: this.littleEndian,
        })
        this.endian()
        return type
    }

    endEncapsulation(): void {
        const e = this.encapStack.pop()!
        this.littleEndian = e.endian
        this.offset = e.nextOffset
    }

    scanGIOPHeader(): MessageType {
        const magic = this.data.getUint32(0)
        if (magic !== 0x47494f50) {
            throw Error(`Missing GIOP Header Magic Number (got 0x${magic.toString(16)}, expected 0x47494f50`)
        }
        this.offset += 4

        this.majorVersion = this.octet()
        this.minorVersion = this.octet()
        // if (giopMajorVersion !== GIOPBase.MAJOR_VERSION && giopMinorVersion !== GIOPBase.MINOR_VERSION) {
        //     throw Error(`Unsupported GIOP ${giopMajorVersion}.${giopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
        // }

        this.endian()
        this.type = this.octet()
        this.length = this.ulong()
        // if (this.buffer.byteLength !== length + 12) {
        //     throw Error(`GIOP message is ${length + 12} bytes but buffer contains ${this.buffer.byteLength}.`)
        // }
        return this.type
    }

    scanLocateRequest() {
        const data = new LocateRequest()
        data.requestId = this.ulong()
        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            data.objectKey = this.blob()
        } else {
            const addressingDisposition = this.ushort()
            switch (addressingDisposition) {
                case AddressingDisposition.KeyAddr:
                    data.objectKey = this.blob()
                    break
                case AddressingDisposition.ProfileAddr:
                case AddressingDisposition.ReferenceAddr:
                    throw Error(`Unsupported AddressingDisposition(${AddressingDisposition[addressingDisposition]})`)
                default:
                    throw Error(`Unknown AddressingDisposition(${addressingDisposition})`)
            }
        }
        return data
    }

    scanLocateReply() {
        const data = new LocateReply()
        data.requestId = this.ulong()
        data.status = this.ulong()
        return data
    }

    scanRequestHeader(): RequestData {
        const data = new RequestData()

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            data.serviceContext = this.serviceContext()
        }
        data.requestId = this.ulong()
        const responseFlags = this.octet()
        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            data.responseExpected = responseFlags != 0
        } else {
            // console.log(`responseFlags=${responseFlags}`)
            switch (responseFlags) {
                case 0: // SyncScope.NONE, WITH_TRANSPORT
                    data.responseExpected = false
                    break
                case 1: // WITH_SERVER
                    break
                case 2:
                    break
                case 3: // WITH_TARGET
                    data.responseExpected = true
                    break
            }
        }
        this.offset += 3 // RequestReserved

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            data.objectKey = this.blob()
        } else {
            // FIXME: duplicated code
            const addressingDisposition = this.ushort()
            switch (addressingDisposition) {
                case AddressingDisposition.KeyAddr:
                    data.objectKey = this.blob()
                    break
                case AddressingDisposition.ProfileAddr:
                case AddressingDisposition.ReferenceAddr:
                    throw Error(`Unsupported AddressingDisposition(${AddressingDisposition[addressingDisposition]})`)
                default:
                    throw Error(`Unknown AddressingDisposition(${addressingDisposition})`)
            }
        }

        // FIXME: rename 'method' into 'operation' as it's named in the CORBA standard
        data.method = this.string()

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            const requestingPrincipalLength = this.ulong()
            // FIXME: this.offset += requestingPrincipalLength???
        } else {
            data.serviceContext = this.serviceContext()
            this.align(8)
        }

        // console.log(`requestId=${data.requestId}, responseExpected=${data.responseExpected}, objectKey=${data.objectKey}, method=${data.method}, requestingPrincipalLength=${requestingPrincipalLength}`)
        return data
    }

    scanReplyHeader(): ReplyData {
        const data = new ReplyData()

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.serviceContext()
        }
        data.requestId = this.ulong()
        data.replyStatus = this.ulong()
        if (this.majorVersion == 1 && this.minorVersion >= 2) {
            this.serviceContext()
        }

        return data
    }

    // return data, move checking the auth stuff up to the orb
    serviceContext(): any[] {
        const result = []

        const serviceContextListLength = this.ulong()

        // console.log(`serviceContextListLength = ${serviceContextListLength}`)
        for (let i = 0; i < serviceContextListLength; ++i) {
            const serviceId = this.beginEncapsulation()
            // console.log(`serviceContext[${i}] = ${ServiceId[serviceId]} (0x${serviceId.toString(16)})`)

            switch (serviceId) {
                case ServiceId.BI_DIR_IIOP:
                    {
                        const ctx = new BidirectionalIIOPServiceContext()
                        ctx.host = this.string()
                        ctx.port = this.ushort()
                        result.push(ctx)
                        // console.log(`serviceContext[${i}] = BiDirIIOP listenPoint ${host}:${port}`)
                    }
                    break
                case ServiceId.SecurityAttributeService:
                    {
                        const type = this.ulong()
                        // console.log(`serviceContext[${i}] = SecurityAttributeService ${SASType[type]}`)
                        switch (type) {
                            case SASType.EstablishContext:
                                {
                                    const context = new EstablishContext()
                                    context.decode(this)
                                    result.push(context)
                                    // console.log(`InitialContextToken(username="${user}", password="${password}", target_name="${target_name}")`)
                                }
                                break
                            case SASType.CompleteEstablishContext:
                                {
                                    const context = new CompleteEstablishContext()
                                    context.clientContextId = this.ulonglong()
                                    context.contextStateful = this.bool()
                                    // finalContextToken
                                    result.push(context)
                                }
                                break
                            case SASType.ContextError:
                                {
                                    const context = new ContextError()
                                    context.clientContextId = this.ulonglong()
                                    context.majorStatus = this.long()
                                    context.minorStatus = this.long()
                                    // errorToken
                                    result.push(context)
                                }
                                break
                        }
                    }
                    break
                default:
                // console.log(`serviceContext[${i}] = ${ServiceId[serviceId]} (0x${serviceId.toString(16)})`)
            }
            this.endEncapsulation()
        }
        return result
    }

    reference(length: number | undefined = undefined): ObjectReference {
        const data = new ObjectReference()

        // struct IOR, field: string type_id ???
        data.oid = this.string(length)
        // console.log(`IOR: oid: '${data.oid}'`)

        // struct IOR, field: TaggedProfileSeq profiles ???
        const profileCount = this.ulong()
        // console.log(`oid: '${oid}', tag count=${tagCount}`)
        for (let i = 0; i < profileCount; ++i) {
            const profileId = this.beginEncapsulation()
            switch (profileId) {
                // CORBA 3.3 Part 2: 9.7.2 IIOP IOR Profiles
                case IOR.TAG.IOR.INTERNET_IOP:
                    {
                        // console.log(`Internet IOP Component, length=${profileLength}`)
                        const iiopMajorVersion = this.octet()
                        const iiopMinorVersion = this.octet()
                        // if (iiopMajorVersion !== 1 || iiopMinorVersion > 1) {
                        //     throw Error(`Unsupported IIOP ${iiopMajorVersion}.${iiopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
                        // }
                        data.host = this.string()
                        data.port = this.ushort()
                        data.objectKey = this.blob()
                        // console.log(`IOR: IIOP(version: ${iiopMajorVersion}.${iiopMinorVersion}, host: ${data.host}:${data.port}, objectKey: ${data.objectKey})`)
                        // FIXME: use utility function to compare version!!! better use hex: version >= 0x0101
                        if (iiopMajorVersion === 1 && iiopMinorVersion !== 0) {
                            // TaggedComponentSeq
                            const n = this.ulong()
                            // console.log(`IOR: ${n} components`)
                            for (i = 0; i < n; ++i) {
                                const id = this.ulong()
                                const length = this.ulong()
                                const nextOffset = this.offset + length
                                switch (id) {
                                    case TagType.ORB_TYPE:
                                        const typeCount = this.ulong()
                                        for (let j = 0; j < typeCount; ++j) {
                                            const orbType = this.ulong()
                                            const orbTypeNames = [
                                                [0x48500000, 0x4850000f, "Hewlett Packard"],
                                                [0x49424d00, 0x49424d0f, "IBM"],
                                                [0x494c5500, 0x494c55ff, "Xerox"],
                                                [0x49534900, 0x4953490f, "AdNovum Informatik AG"],
                                                [0x56495300, 0x5649530f, "Borland (VisiBroker)"],
                                                [0x4f495300, 0x4f4953ff, "Objective Interface Systems"],
                                                [0x46420000, 0x4642000f, "FloorBoard Software"],
                                                [0x4e4e4e56, 0x4e4e4e56, "Rogue Wave"],
                                                [0x4e550000, 0x4e55000f, "Nihon Unisys, Ltd"],
                                                [0x4a424b52, 0x4a424b52, "SilverStream Software"],
                                                [
                                                    0x54414f00,
                                                    0x54414f00,
                                                    "Center for Distributed Object Computing, Washington University",
                                                ],
                                                [0x4c434200, 0x4c43420f, "2AB"],
                                                [0x41505831, 0x41505831, "Informatik 4, Univ. of Erlangen-Nuernberg"],
                                                [0x4f425400, 0x4f425400, "ORBit"],
                                                [0x47534900, 0x4753490f, "GemStone Systems, Inc."],
                                                [0x464a0000, 0x464a000f, "Fujitsu Limited"],
                                                [0x4e534440, 0x4e53444f, "Compaq Computer"],
                                                [0x4f425f00, 0x4f425f0f, "TIBCO"],
                                                [0x4f414b00, 0x4f414b0f, "Camros Corporation"],
                                                [0x41545400, 0x4154540f, "AT&T Laboratories, Cambridge (OmniORB)"],
                                                [0x4f4f4300, 0x4f4f430f, "IONA Technologies"],
                                                [0x4e454300, 0x4e454303, "NEC Corporation"],
                                                [0x424c5500, 0x424c550f, "Berry Software"],
                                                [0x56495400, 0x564954ff, "Vitra"],
                                                [0x444f4700, 0x444f47ff, "Exoffice Technologies"],
                                                [0xcb0e0000, 0xcb0e00ff, "Chicago Board of Exchange (CBOE)"],
                                                [0x4a414300, 0x4a41430f, "FU Berlin Institut für Informatik (JAC)"],
                                                [0x58545240, 0x5854524f, "Xtradyne Technologies AG"],
                                                [0x54475800, 0x54475803, "Top Graph'X"],
                                                [0x41646100, 0x41646103, "AdaOS project"],
                                                [0x4e4f4b00, 0x4e4f4bff, "Nokia"],
                                                [0x53414e00, 0x53414e0f, "Sankhya Technologies Private Limited, India"],
                                                [0x414e4400, 0x414e440f, "Androsoft GmbH"],
                                                [0x42424300, 0x4242430f, "Bionic Buffalo Corporation"],
                                                [0x4d313300, 0x4d313300, "corba.js"],
                                            ]
                                            let name: string | undefined
                                            for (let x of orbTypeNames) {
                                                if ((x[0] as number) <= orbType && orbType <= (x[1] as number)) {
                                                    name = x[2] as string
                                                    break
                                                }
                                            }
                                            if (name === undefined) {
                                                name = `0x${orbType.toString(16)}`
                                            }
                                            // console.log(`IOR: component[${i}] = ORB_TYPE ${name}`)
                                        }
                                        break
                                    case TagType.CODE_SETS:
                                        // Corba 3.4, Part 2, 7.10.2.4 CodeSet Component of IOR Multi-Component Profile
                                        // console.log(`IOR: component[${i}] = CODE_SETS`)
                                        break
                                    case TagType.POLICIES:
                                        // console.log(`IOR: component[${i}] = POLICIES`)
                                        break
                                    default:
                                    // console.log(`IOR: component[${i}] = ${id} (0x${id.toString(16)})`)
                                }
                                this.offset = nextOffset
                            }
                        }
                    }
                    break
                default:
                // console.log(`IOR: Unhandled profile type=${profileId} (0x${profileId.toString(16)})`)
            }
            this.endEncapsulation()
        }
        return data
    }

    // WIP: beginning to split the object() method
    value(typeInfo: string | undefined = undefined): any {
        return this.object(typeInfo, true)
    }

    // TODO: rather 'value' than 'object' as this is for valuetypes?
    object(typeInfo: string | undefined = undefined, isValue: boolean = false): any {
        // const objectOffset = this.offset + 6

        const code = this.ulong()
        if (code === 0) {
            return undefined
        }

        const objectOffset = this.offset - 4

        // console.log(`GIOPDecoder.object(${typeInfo}) code=0x${code.toString(16)}, offset=0x${objectOffset.toString(16)}}`)

        // 9.3.4.1 Partial Type Information and Versioning
        // NOTE: when there's no repositoryID, take the one from the IDL file
        //       better: point to the entry in ORB.valueTypeByName.get(...) to avoid
        //       to lookup the valuetype at runtime
        // TODO: add test for sending a subclassed valuetype, as in that case i'd expect
        //       a repositoryID to be send
        // TODO: add two tests which also check that has been and hasn't been a repository id

        // NOTE: 9.3.4.1 closes with:
        // CORBA RepositoryIDs may contain standard version identification (major and minor version
        // numbers or a hash code information). The ORB run time may use this information to check
        // whether the version of the value being transmitted is compatible with the version expected.
        // In the event of a version mismatch, the ORB may apply product-specific truncation/conversion
        // rules (with the help of a local interface repository or the SendingContext::RunTime service).
        // For example, the Java serialization model of truncation/conversion across versions can be supported. See the JDK 1.1 documentation for a detailed specification of this model.
        //
        // => versioning approaches
        // truncation  : when a later version is send, add new entries add the end
        //               this approach matches the one used in REST
        // conversation: have a look into what Java does here and check how it matches
        //               the version-less configuration files i invented for the mGuard
        // also compare this with ICE!
        if ((code & 0xffffff00) === 0x7fffff00) {
            let valueTypeConstructor: any
            if (code & 1) {
                // parse codebase_URL
                throw Error(`value_tag contains unsupported codebase URL`)
            }
            if ((code & 6) === 2) {
                // parse single repository id
                let repositoryId
                const len = this.ulong()
                if (len !== 0xffffffff) {
                    repositoryId = this.string(len)
                } else {
                    const offset = this.offset
                    const indirection = this.long()
                    const nextOffset = this.offset
                    this.offset = offset + indirection
                    if ((this.offset & 0x03) !== 0) {
                        console.error(
                            `WRONG INDIRECTION: GOT 0x${this.offset.toString(16)}, EXPECTED 0x${(
                                this.offset -
                                (this.offset & 0x03)
                            ).toString(16)}`
                        )
                        this.offset = this.offset - (this.offset & 0x03)
                    }
                    repositoryId = this.string()
                    this.offset = nextOffset
                }
                if (
                    repositoryId.length < 8 ||
                    repositoryId.substring(0, 4) !== "IDL:" ||
                    repositoryId.substring(repositoryId.length - 4) !== ":1.0"
                )
                    throw Error(`Unsupported CORBA GIOP Repository ID '${repositoryId}'`)
                const shortName = repositoryId.substring(4, repositoryId.length - 4)
                valueTypeConstructor = ORB.lookupValueType(shortName)
                if (valueTypeConstructor === undefined)
                    throw Error(`Unregistered Repository ID '${repositoryId}' (${shortName})`)
            }
            if ((code & 6) === 6) {
                // parse list of repository ids
                throw Error(`value_tag contains unsupported list of repository IDs`)
            }

            if (valueTypeConstructor === undefined && typeInfo !== undefined) {
                valueTypeConstructor = ORB.lookupValueType(typeInfo)
            }

            if (valueTypeConstructor === undefined) {
                throw Error(`insufficient value type information`)
            }

            const obj = new valueTypeConstructor(this)
            this.objects.set(objectOffset + 2, obj)
            return obj
        }

        if (code === 0xffffffff) {
            let indirection = this.long()
            indirection += 2
            const position = this.offset + indirection
            // console.log(`GIOPDecoder.object(): at 0x${objectOffset.toString(16)} got indirect object ${indirection} pointing to 0x${position.toString(16)}`)
            const obj = this.objects.get(position)
            if (obj === undefined) {
                throw Error("IDL:omg.org/CORBA/MARSHAL:1.0")
            }
            return obj
        }

        // TODO: this looks like a hack... plus: can't the IDL compiler not already use reference instead of object?
        if (code < 0x7fffff00) {
            if (this.connection === undefined)
                throw Error("GIOPDecoder has no connection defined. Can not resolve resolve reference to stub object.")
            const reference = this.reference(code)

            if (reference.host == this.connection.localAddress && reference.port == this.connection.localPort) {
                return this.connection.orb.servants.get(reference.objectKey)
            }

            // TODO: this belongs elsewhere
            let object = this.connection.stubsById.get(reference.objectKey)
            if (object !== undefined) {
                return object
            }
            const shortName = reference.oid.substring(4, reference.oid.length - 4)
            let aStubClass = this.connection.orb.stubsByName.get(shortName)
            if (aStubClass === undefined) {
                // throw Error(`ORB: no stub registered for OID '${reference.oid}' (${shortName})`)
                throw new OBJECT_ADAPTER(0x4f4d0003, CompletionStatus.NO)
            }
            object = new aStubClass(this.connection.orb, reference.objectKey, this.connection)
            this.connection.stubsById.set(reference.objectKey, object!)
            return object
        }

        throw Error(`GIOPDecoder: Unsupported value with CORBA tag 0x${code.toString(16)}`)
    }

    endian() {
        const byteOrder = this.octet()
        this.littleEndian = byteOrder === GIOPBase.ENDIAN_LITTLE
    }

    blob(length?: number) {
        if (length === undefined) {
            length = this.ulong()
        }
        const value = this.bytes.subarray(this.offset, this.offset + length)
        this.offset += length
        return value
    }

    string(length?: number) {
        if (length === undefined) {
            length = this.ulong()
        }
        const rawString = this.bytes.subarray(this.offset, this.offset + length - 1)
        const value = GIOPDecoder.textDecoder.decode(rawString)
        this.offset += length
        return value
    }

    sequence<T>(decodeItem: () => T): T[] {
        const length = this.ulong()
        const array = new Array(length)
        for (let i = 0; i < length; ++i) {
            array[i] = decodeItem()
        }
        return array
    }

    // FIXME: make this a global constant
    isPlatformLittleEndian() {
        const buffer = new ArrayBuffer(2)
        new Int16Array(buffer)[0] = 0x1234
        return new DataView(buffer).getUint8(0) === 0x34
    }

    sequenceOctet(): Uint8Array {
        const nbytes = this.ulong()
        const buffer = new Uint8Array(this.buffer, this.offset, nbytes)
        this.offset += nbytes
        return buffer
    }

    sequenceFloat(): Float32Array {
        const length = this.ulong()
        // no further alignment needed due to previous ulong() call
        if (this.littleEndian != this.isPlatformLittleEndian()) {
            const result = new Float32Array(length)
            for (let i = 0; i < length; ++i) {
                result[i] = this.data.getFloat32(this.offset, this.littleEndian)
                this.offset += 4
            }
            return result
        } else {
            const result = new Float32Array(this.buffer, this.offset, length)
            this.offset += length * 4
            return result
        }
    }
    sequenceDouble(): Float64Array {
        const length = this.ulong()
        this.align(8);
        if (this.littleEndian != this.isPlatformLittleEndian()) {
            const result = new Float64Array(length)
            for (let i = 0; i < length; ++i) {
                result[i] = this.data.getFloat64(this.offset, this.littleEndian)
                this.offset += 8
            }
            return result
        } else {
            const result = new Float64Array(this.buffer, this.offset, length)
            this.offset += length * 8
            return result
        }
    }

    bool() {
        const value = this.data.getUint8(this.offset) !== 0
        ++this.offset
        return value
    }

    char() {
        const value = String.fromCharCode(this.data.getUint8(this.offset))
        ++this.offset
        return value
    }

    octet() {
        const value = this.data.getUint8(this.offset)
        ++this.offset
        return value
    }

    short() {
        this.align(2)
        const value = this.data.getInt16(this.offset, this.littleEndian)
        this.offset += 2
        return value
    }

    ushort() {
        this.align(2)
        const value = this.data.getUint16(this.offset, this.littleEndian)
        this.offset += 2
        return value
    }

    long() {
        this.align(4)
        const value = this.data.getInt32(this.offset, this.littleEndian)
        this.offset += 4
        return value
    }

    ulong() {
        this.align(4)
        const value = this.data.getUint32(this.offset, this.littleEndian)
        this.offset += 4
        return value
    }

    longlong() {
        this.align(8)
        const value = this.data.getBigInt64(this.offset, this.littleEndian)
        this.offset += 8
        return value
    }

    ulonglong() {
        this.align(8)
        const value = this.data.getBigUint64(this.offset, this.littleEndian)
        this.offset += 8
        return value
    }

    float() {
        this.align(4)
        const value = this.data.getFloat32(this.offset, this.littleEndian)
        this.offset += 4
        return value
    }

    double() {
        this.align(8)
        const value = this.data.getFloat64(this.offset, this.littleEndian)
        this.offset += 8
        return value
    }

    asn1number(): number {
        let n = 0
        while (true) {
            const c = this.octet()
            n <<= 7
            if (c & 0x80) {
                n |= c & 0x7f
            } else {
                n |= c
                break
            }
        }
        return n
    }

    asn1tag() {
        const tag = new ASN1Tag()
        let state = 0
        let lenghtOfLength!: number
        while (state >= 0) {
            const c = this.octet()
            // console.log(`state ${state}, c=${c.toString(16)}`)
            switch (state) {
                case 0: // tag
                    tag.tagClass = (c & 0xc0) >> 6 // 11000000
                    tag.encoding = (c & 0x20) >> 5 // 00100000
                    tag.tag = c & 0x1f // 00011111
                    if (tag.tag == 0x1f) {
                        state = 1
                        tag.tag = 0
                    } else {
                        state = 2
                    }
                    break
                case 1: // long tag
                    tag.tag <<= 7
                    tag.tag |= c & 0x7f
                    if (c & 0x80) {
                        state = 2
                    }
                    break
                case 2: // length
                    tag.length = c
                    if (c & 0x80) {
                        lenghtOfLength = tag.length & 0x7f
                        tag.length = 0
                        state = 3
                    } else {
                        state = -1
                    }
                    break
                case 3: // long length
                    tag.length <<= 8
                    tag.length |= c
                    if (--lenghtOfLength == 0) {
                        state = -1
                    }
                    break
            }
        }
        return tag
    }

    asn1oid(len: number) {
        const oid: number[] = []
        let state = 0
        let akku = 0
        for (let i = 0; i < len; ++i) {
            const c = this.octet()
            switch (state) {
                case 0:
                    oid.push(Math.floor(c / 40))
                    oid.push(c % 40)
                    state = 1
                    break
                case 1:
                    if (c & 0x80) {
                        akku = c & 0x7f
                        state = 2
                    } else {
                        oid.push(c)
                    }
                    break
                case 2:
                    akku <<= 7
                    akku |= c & 0x7f
                    if (!(c & 0x80)) {
                        oid.push(akku)
                        state = 1
                    }
                    break
            }
        }
        return oid
    }

    asn1expect(cls: ASN1Class, tag: ASN1UniversalTag, encoding: ASN1Encoding): ASN1Tag | undefined {
        const t0 = this.asn1tag()
        if (t0.tagClass !== cls || t0.tag !== tag || t0.encoding !== encoding) {
            console.log(`Can not authenticate client: ASN.1 decoding error`)
            return undefined
        }
        return t0
    }

    asn1expectOID(oid: number[]): boolean {
        const t1 = this.asn1expect(ASN1Class.UNIVERSAL, ASN1UniversalTag.OID, ASN1Encoding.PRIMITIVE)
        if (t1 === undefined) {
            return false
        }
        const got = this.asn1oid(t1.length)
        if (oid.length !== got.length) {
            console.log(`Can not authenticate client: Wrong OID`)
            return false
        }
        for (let i = 0; i < oid.length; ++i) {
            if (oid[i] !== got[i]) {
                console.log(`Can not authenticate client: Wrong OID`)
                return false
            }
        }
        return true
    }

    // TODO: the code in corba.cc is better
    // TODO: do not align when decoding structures, argument lists and data types
    //       unless there is an element of variable size in it
    align(alignment: number) {
        const inversePadding = this.offset % alignment
        if (inversePadding !== 0) {
            this.offset += alignment - inversePadding
        }
    }
}

function hexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
    while (addr < length) {
        let line = addr.toString(16).padStart(4, "0")
        for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j)
            line += " " + bytes[j].toString(16).padStart(2, "0")
        line = line.padEnd(4 + 16 * 3 + 1, " ")
        for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j) {
            const b = bytes[j]
            if (b >= 32 && b < 127) {
                line += String.fromCharCode(b)
            } else {
                line += "."
            }
        }
        addr += 16
        console.log(line)
    }
}
