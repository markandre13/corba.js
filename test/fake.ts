import * as fs from "fs"
import { Socket } from "net"
import { ORB } from "corba.js"

// https://martinfowler.com/bliki/SelfInitializingFake.html
export class Fake {
    orb!: ORB
    socket!: Socket
    verbose = false

    testName?: string
    recordMode = false
    fd: number = -1;
    buffer: string[] = []

    reset() {
        this.testName = undefined
        if (this.fd !== -1) {
            fs.closeSync(this.fd)
            this.fd = -1
        }
    }

    record(orb: ORB, socket: Socket) {
        this.recordMode = true
        this.orb = orb
        this.socket = socket

        socket.removeAllListeners()
        socket.on("error", (error: Error) => orb.socketError(error))
        socket.on("close", (hadError: boolean) => orb.socketClosed())
        socket.on("data", (data: Buffer) => {
            const view = new Uint8Array(data)
            if (this.testName) {
                const dump = this.toHexdump(view)
                fs.writeSync(this.fd, "IN\n")
                fs.writeSync(this.fd, dump)
                if (this.verbose) {
                    console.log("RCVD")
                    console.log(dump)
                }
            }
            orb.socketRcvd(data.buffer)
        })

        const send = orb.socketSend
        orb.socketSend = (buffer: ArrayBuffer) => {
            if (this.testName) {
                const view = new Uint8Array(buffer)
                const dump = this.toHexdump(view)
                fs.writeSync(this.fd, "OUT\n")
                fs.writeSync(this.fd, dump)
                if (this.verbose) {
                    console.log("SEND")
                    console.log(dump)
                }
            }
            send(buffer)
        }
    }

    replay(orb: ORB) {
        this.orb = orb
        orb.socketSend = (buffer: ArrayBuffer) => {
            if (this.testName === undefined) {
                throw Error(`Fake is in replay mode but no expectation has been set up.`)
            }
            const view = new Uint8Array(buffer)
            let line = this.buffer.shift()
            if (line !== "OUT") {
                throw Error(`Expected OUT but got '${line}'`)
            }
            const data = this.fromHexdump()
            if (data.compare(view) !== 0) {
                console.log("EXPECTED")
                console.log(this.toHexdump(data))
                console.log("GOT")
                console.log(this.toHexdump(view))
                throw Error(`Output does not match expectation.`)
            }
            this.handleIn()
        }
    }

    expect(name: string) {
        if (this.testName !== undefined) {
            throw Error("test fake setup error: missing reset() call. try to add this to you test: beforeEach(function() { fake.reset() })")
        }
        this.testName = `test/giop/${name.replace(/\W/g, "-")}.dump`
        if (this.recordMode) {
            this.fd = fs.openSync(this.testName, "w+")
        } else {
            this.buffer = fs.readFileSync(this.testName!).toString("ascii").split(/\r?\n/)
        }
        // console.log(`EXPECT ${name} (${this.testName})`)
    }

    protected handleIn() {
        let line = this.buffer.shift()
        if (line === "IN") {
            setTimeout(() => {
                const data = this.fromHexdump()
                const b2 = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
                this.orb.socketRcvd(b2)
                this.handleIn()
            }, 0)
        } else {
            if (line !== undefined) {
                this.buffer.unshift(line)
            }
        }
    }

    protected toHexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
        let result = ""
        while (addr < length) {
            let line = addr.toString(16).padStart(4, "0")
            for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j)
                line += " " + bytes[j].toString(16).padStart(2, "0")
            line = line.padEnd(4 + 16 * 3 + 1, " ")
            for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j) {
                const b = bytes[j]
                if (b >= 32 && b < 127)
                    line += String.fromCharCode(b)

                else
                    line += "."
            }
            addr += 16
            result += line + "\n"
        }
        return result
    }

    protected fromHexdump() {
        const x: number[] = []
        while (true) {
            const line = this.buffer.shift()
            if (line === undefined)
                break
            if (line.length < 4) {
                this.buffer.unshift(line)
                break
            }
            for (let i = 0; i < 16; ++i) {
                const offset = 5 + i * 3
                const byte = parseInt(line.substring(offset, offset + 2), 16)
                if (Number.isNaN(byte))
                    break
                x.push(byte)
            }
        }
        return Buffer.from(x)
    }
}
