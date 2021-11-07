
all: client server

# -ORBmaxGIOPVersion 1.2 -ORBoneCallPerConnection 0 -ORBofferBiDirectionalGIOP 1
# 

# NameServer
# mkdir datadir
# 1st time: omniNames -datadir datadir -start
# other   : omniNames -datadir datadir
# copy'n pate the IOR to
# -ORBInitRef NameService=IOR:010000002b00000049444c3a6f6d672e6f72672f436f734e616d696e672f4e616d696e67436f6e746578744578743a312e300000010000000000000070000000010102000d0000003139322e3136382e312e31300000f90a0b0000004e616d6553657276696365000300000000000000080000000100000000545441010000001c000000010000000100010001000000010001050901010001000000090101000354544108000000121c786101000608

NS=-ORBInitRef NameService=IOR:010000002b00000049444c3a6f6d672e6f72672f436f734e616d696e672f4e616d696e67436f6e746578744578743a312e300000010000000000000070000000010102000d0000003139322e3136382e312e31300000f90a0b0000004e616d6553657276696365000300000000000000080000000100000000545441010000001c000000010000000100010001000000010001050901010001000000090101000354544108000000c32a786101000db2

runs: server
	killall server ; LD_LIBRARY_PATH=/usr/local/lib ./server -ORBtraceLevel 40 -ORBoneCallPerConnection 0 -ORBacceptBiDirectionalGIOP 1 -ORBofferBiDirectionalGIOP 1 -ORBserverTransportRule "* unix,tcp,bidir" $(NS)

runc: client
	LD_LIBRARY_PATH=/usr/local/lib ./client -ORBtraceLevel 40 -ORBoneCallPerConnection 0 -ORBacceptBiDirectionalGIOP 1 -ORBofferBiDirectionalGIOP 1 -ORBserverTransportRule "* unix,tcp,bidir"

client: client.cc giopSK.cc giop.hh
	g++ -O0 -g -lomniORB4 -lomniDynamic4 -lomnithread -o client client.cc giopSK.cc

server: server.cc giopSK.cc giop.hh
	g++ -O0 -g -lomniORB4 -lomniDynamic4 -lomnithread -o server server.cc giopSK.cc

serverx: server.cc test.cc test_skel.cc test.h valueimpl.hh
	g++ -O0 -g -I. -Wno-deprecated -lmico2.3.13 -lpthread -ldl -o server server.cc test.cc test_skel.cc

giopSK.cc giop.hh: giop.idl
	rm -f giopSK.cc giop.hh
	omniidl -bcxx -nc giop.idl

clean:
	rm -f giopSK.cc giop.hh