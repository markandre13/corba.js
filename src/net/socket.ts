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

import { ORB } from "corba.js"
import { Socket, Server, createServer, AddressInfo } from "net"

export function connect(orb: ORB, host: string, port: number): Promise<Socket> {
    return new Promise<Socket>((resolve, reject) => {
        const socket = new Socket()
        socket.setNoDelay()
        socket.on("error", (error: Error) => orb.socketError(error))
        socket.on("close", (hadError: boolean) => orb.socketClose())
        socket.on("data", (data: Buffer) => orb.socketRcvd(data.buffer))
        orb.socketSend = (buffer: ArrayBuffer) => {
            socket.write(new Uint8Array(buffer))
        }
        // socket.on('error', (e) => {
        //     reject(e)
        // })
        socket.connect(port, host, () => {
            if (orb.localAddress === undefined)
                orb.localAddress = socket.localAddress
            if (orb.localPort === undefined)
                orb.localPort = socket.localPort
            orb.remoteAddress = socket.remoteAddress!
            orb.remotePort = socket.remotePort!

            console.log(`SOCKET LOCAL ADDRESS : ${socket.localAddress}`)
            console.log(`SOCKET LOCAL PORT    : ${socket.localPort}`)
            console.log(`SOCKET REMOTE ADDRESS: ${socket.remoteAddress}`)
            console.log(`SOCKET REMOTE PORT   : ${socket.remotePort}`)

            console.log(`ORB LOCAL ADDRESS : ${orb.localAddress}`)
            console.log(`ORB LOCAL PORT    : ${orb.localPort}`)
            console.log(`ORB REMOTE ADDRESS: ${orb.remoteAddress}`)
            console.log(`ORB REMOTE PORT   : ${orb.remotePort}`)

            resolve(socket)
        })
    })
}

export function listen(orb: ORB, host: string, port: number) {
    return new Promise<Server>((resolve, reject) => {
        const serverSocket = createServer((socket) => {
            socket.setNoDelay()
            const clientORB = new ORB(orb)
            socket.on("error", (error: Error) => orb.socketError(error))
            socket.on("close", (hadError: boolean) => orb.socketClose())
            socket.on("data", (data: Buffer) => orb.socketRcvd(data.buffer))
            orb.socketSend = (buffer: ArrayBuffer) => {
                socket.write(new Uint8Array(buffer))
            }
            clientORB.localAddress = socket.localAddress
            clientORB.localPort = socket.localPort
            clientORB.remoteAddress = socket.remoteAddress!
            clientORB.remotePort = socket.remotePort!
        })
        serverSocket.on('error', (e) => {
            reject(e)
        })
        serverSocket.listen(port, host, () => {
            const address = serverSocket.address() as AddressInfo
            orb.localAddress = address.address
            orb.localPort = address.port
            resolve(serverSocket)
        })
    })
}
