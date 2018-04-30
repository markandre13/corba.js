import * as server from "../src/orb/orb-nodejs"
import * as client from "../src/orb/orb"

export function mockConnection(serverORB: server.ORB, clientORB: client.ORB) {
    let acceptedORB = new server.ORB(serverORB)

    acceptedORB.socket = {
        send: function(data: any) {
            clientORB.socket!.onmessage({data:data} as any)
        }
    } as any
    acceptedORB.accept()
    clientORB.socket = {
        send: function(data: any) {
            acceptedORB.socket!.onmessage({data:data} as any)
        }
    } as any
}

