import { Type, Node } from "../idl-node"
import { Direction } from "./typeIDLtoCC"

// this is about how to call the GIOP(Encoder|Decoder)
export function typeIDLtoGIOPCC(
    type: Node | undefined,
    arg: string | undefined = undefined,
    direction: Direction
): string {
    if (type === undefined) throw Error("internal error: parser delivered no type information")
    // console.log(`typeIDLtoGIOP(${type.toString()}, ${arg})`)
    let name: string
    switch (type!.type) {
        case Type.TKN_IDENTIFIER:
        case Type.TKN_MODULE:
            return typeIDLtoGIOPCC(type.child[0], arg, direction)
        case Type.TKN_VALUETYPE:
            return arg === undefined ? `decoder.value("${type.text}")` : `encoder.value(${arg})`
        case Type.SYN_INTERFACE:
            // name = "object"
            return arg === undefined ? `co_await ${type.text}::_narrow(decoder.readObject(obj->get_ORB()))` : `encoder.writeObject(${arg}.get())`
            break
        case Type.TKN_UNION:
        case Type.TKN_STRUCT: {
            throw Error("yikes")
            // const prefix = filetype === FileType.INTERFACE ? "" : "_interface."
            // return arg === undefined
            //     ? `${prefix}decode${type!.text!}(decoder)`
            //     : `${prefix}encode${type!.text!}(encoder,${arg})`
        }
        case Type.TKN_NATIVE:
            {
                const id = type!.child[0]!.text!
                if (id.length > 4 && id.substring(id.length - 4) === "_ptr") {
                    return arg === undefined
                        ? `decoder.value("${id.substring(0, id.length - 4)}")`
                        : `encoder.value(${arg})`
                } else {
                    return `undefined`
                }
            }
            break

        case Type.TKN_VOID:
            name = "Void"
            break
        case Type.TKN_BOOLEAN:
            name = "Boolean"
            break
        case Type.TKN_CHAR:
            name = "Char"
            break
        case Type.TKN_OCTET:
            name = "Octet"
            break
        case Type.TKN_SHORT:
            name = "Short"
            break
        case Type.TKN_LONG:
            name = "Long"
            break
        case Type.SYN_LONGLONG:
            name = "Longlong"
            break
        case Type.SYN_UNSIGNED_SHORT:
            name = "Ushort"
            break
        case Type.SYN_UNSIGNED_LONG:
            name = "Ulong"
            break
        case Type.SYN_UNSIGNED_LONGLONG:
            name = "Ulonglong"
            break
        case Type.TKN_FLOAT:
            name = "Float"
            break
        case Type.TKN_DOUBLE:
            name = "Double"
            break
        case Type.SYN_LONG_DOUBLE:
            name = "LongDouble"
            break
        case Type.TKN_STRING:
            switch(direction) {
                case Direction.IN: // skel/impl: decode incoming argument
                    return arg === undefined ? `decoder.readStringView()` : `encoder.writeString(${arg})`
                case Direction.OUT: // stub: decode incoming return value
                    return arg === undefined ? `decoder.readString()` : `encoder.writeString(${arg})`    
            }
            throw Error("yikes")
        case Type.TKN_ENUM:
            return arg === undefined ? `static_cast<${type.text}>(decoder.readUlong())` : `encoder.writeUlong(std::to_underlying(${arg}))`
        case Type.TKN_SEQUENCE:
            switch (type!.child[0]!.type) {
                case Type.TKN_OCTET: {
                    switch (direction) {
                        case Direction.IN:
                            return arg === undefined ? `decoder.readBlobView()` : `encoder.writeBlob(${arg})`
                        case Direction.OUT:
                            return arg === undefined ? `decoder.readBlob()` : `encoder.writeBlob(${arg})`
                    }
                }
                case Type.TKN_FLOAT: {
                    switch (direction) {
                        case Direction.IN:
                            return arg === undefined ? `decoder.readSequenceSpanFloat()` : `encoder.writeSequence(${arg})`
                        case Direction.OUT:
                            return arg === undefined ? `decoder.readSequenceVectorFloat()` : `encoder.writeSequence(${arg})`
                    }
                }
                case Type.TKN_STRING:
                    // co_await obj->callSeqString(decoder.sequence(() => decoder.readStringView()));
                    // co_await obj->callSeqString(decoder.readSequenceVector([&] { return decoder.readStringView(); }));

                    // encoder.sequence(value, (item) => encoder.writeString(item));
                    // encoder.writeSequence<std::string_view>(value, [&](auto item) { encoder.writeString(item);});

                    return arg === undefined
                        ? `decoder.readSequenceVector<std::string_view>([&] { return decoder.readStringView(); })`
                        : `encoder.writeSequence<std::string_view>(${arg}, [&](auto item) { encoder.writeString(item);})`
            }
            return arg === undefined
                ? `decoder.sequence(() => ${typeIDLtoGIOPCC(type.child[0], undefined, direction)})`
                : `encoder.sequence(${arg}, (item) => ${typeIDLtoGIOPCC(type.child[0], "item", direction)})`
        default:
            type.printTree()
            throw Error(`no mapping from IDL type '${type.toString()}' to GIOP encoder/decoder`)
    }
    return arg === undefined ? `decoder.read${name}()` : `encoder.write${name}(${arg})`
}
