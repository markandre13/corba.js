export class Uint8Map<V> {
    private static byteToHex = new Array<string>(0xff);
    private map = new Map<string, V>();

    set(key: Uint8Array, value: V): Uint8Map<V> {
        this.map.set(Uint8Map.hex(key), value)
        return this
    }
    delete(key: Uint8Array): boolean {
        return this.map.delete(Uint8Map.hex(key))
    }
    get(key: Uint8Array): V | undefined {
        return this.map.get(Uint8Map.hex(key))
    }
    has(key: Uint8Array): boolean {
        return this.map.has(Uint8Map.hex(key))
    }
    get size(): number {
        return this.map.size
    }

    static hex(buffer: Uint8Array) {
        let hexOctets = ""
        for (let i = 0; i < buffer.length; ++i)
            hexOctets += Uint8Map.byteToHex[buffer[i]]
        return hexOctets
    }

    private static init = (function () {
        for (let n = 0; n <= 0xff; ++n) {
            const hexOctet = n.toString(16).padStart(2, "0")
            Uint8Map.byteToHex[n] = hexOctet
        }
    })();
}
