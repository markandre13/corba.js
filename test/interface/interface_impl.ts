import { Interface } from "../generated/interface_skel"

export class Interface_impl extends Interface {
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
}
