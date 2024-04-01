import { Peer } from "../generated/interface"
import { Interface as Interface_skel, Peer as Peer_skel } from "../generated/interface_skel"

export class Interface_impl extends Interface_skel {
    override async callBoolean(value: boolean): Promise<boolean> {
        return value
    }
    override async callOctet(value: number): Promise<number> {
        return value
    }

    override async callUShort(value: number): Promise<number> {
        return value
    }
    override async callUnsignedLong(value: number): Promise<number> {
        return value
    }
    override async callUnsignedLongLong(value: bigint): Promise<bigint> {
        return value
    }

    override async callShort(value: number): Promise<number> {
        return value
    }
    override async callLong(value: number): Promise<number> {
        return value
    }
    override async callLongLong(value: bigint): Promise<bigint> {
        return value
    }

    override async callFloat(value: number): Promise<number> {
        return value
    }
    override async callDouble(value: number): Promise<number> {
        return value
    }

    override async callString(value: string): Promise<string> {
        return value
    }
    override async callBlob(value: Uint8Array): Promise<Uint8Array> {
        return value
    }
    override async callSeqFloat(value: Float32Array): Promise<Float32Array> {
        return value
    }
    override async callSeqDouble(value: Float64Array): Promise<Float64Array> {
        return value
    }
    override async callSeqString(value: Array<string>): Promise<Array<string>> {
        return value
    }

    peer?: Peer
    override async setPeer(peer: Peer): Promise<void> {
        this.peer = peer
    }
    override async callPeer(value: string): Promise<string> {
        const s = await this.peer?.callString(value + " to the")
        return s + "."
    }
}

export class Peer_impl extends Peer_skel {
    override async callString(value: string): Promise<string> {
        return value + " world"
    }
}