import { ORB, GIOPDecoder, MessageType, LocateStatusType, ReplyStatus, GIOPEncoder } from "corba.js"
import { ASN1Tag, ASN1Class, ASN1Encoding, ASN1UniversalTag } from "corba.js/orb/asn1"
import { parseHexDump } from "../util"
import { expect } from "chai"

describe("ASN.1", function() {
    it("decode", function () {
        // [IETF RFC 2743] 3.1, “Mechanism-Independent Token Format,” pp. 81-82.
        // { iso-itu-t (2) international-organization (23) omg (130) security (1) authentication (1) gssup-mechanism (1) }
        const data = parseHexDump(
            `0000 60 28 06 06 67 81 02 01 01 01 00 00 00 00 00 00 .(..g...........
            0010 00 08 74 65 73 74 55 73 65 72 00 00 00 08 74 65 ..testUser....te
            0020 73 74 50 61 73 73 00 00 00 00                   stPass....`)
        const decoder = new GIOPDecoder(data.buffer)

        const t0 = decoder.asn1tag()
        expect(t0).to.deep.equal(new ASN1Tag(ASN1Class.APPLICATION, 0, ASN1Encoding.CONSTRUCTED, 40))

        const t1 = decoder.asn1tag()
        expect(t1).to.deep.equal(new ASN1Tag(ASN1Class.UNIVERSAL, ASN1UniversalTag.OID, ASN1Encoding.PRIMITIVE, 6))

        console.log(t1.toString())
        const oid = decoder.asn1oid(t1.length)
        expect(oid).to.deep.equal([2, 23, 130, 1, 1, 1])

        const cdr = new GIOPDecoder(decoder.buffer.slice(decoder.offset))
        cdr.endian()
        const te = new TextDecoder()
        const user = te.decode(cdr.blob())
        const password = te.decode(cdr.blob())
        const realm = te.decode(cdr.blob())
        expect(user).to.equal("testUser")
        expect(password).to.equal("testPass")
        expect(realm).to.equal("")
        expect(decoder.offset).to.equal(10)
    })
})