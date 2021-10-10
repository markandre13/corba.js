#include "test.h"
#include "test_impl.h"
#include <iostream>
#include <fstream>
#include <sstream>

#define REGISTER_VALUE_TYPE(T) \
  struct T ## _Factory: public CORBA::ValueFactoryBase { \
    CORBA::ValueBase* create_for_unmarshal() { \
      return new T ## _impl(); \
    } \
  }; \
  orb->register_value_factory("IDL:" #T ":1.0", new T ## _Factory());

using namespace std;

const char * blank = "THIS PAGE INTENTIONALLY LEFT BLANK";
string lastToken(blank);

class Point_impl: virtual public OBV_Point, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Point_impl() {}
    Point_impl(double x, double y) {
      this->x(x);
      this->y(y);
    }
};

int
main(int argc, char **argv) {
    int rc = 0;
    try {
        // init ORB and POA Manager
        CORBA::ORB_var orb = CORBA::ORB_init(argc, argv, "mico-local-orb");

        REGISTER_VALUE_TYPE(Point)

        CORBA::Object_var poaobj = orb->resolve_initial_references("RootPOA");
        PortableServer::POA_var poa = PortableServer::POA::_narrow( poaobj);
        PortableServer::POAManager_var mgr = poa->the_POAManager();

        // create a new instance of the servant
        GIOPTest_impl *impl = new GIOPTest_impl();
        // activate the servant
        GIOPTest_var f = impl->_this();
        // save the Interoperable Object Reference (IOR) to a file
        CORBA::String_var s = orb->object_to_string(f);
        ofstream out("IOR.txt");
        out << s << endl;
        out.close();
        // activate POA manager
        mgr->activate();
        // run the ORB
        cout << "ORB is running..." << endl;
        orb->run();
        poa->destroy(TRUE, TRUE);
        delete impl;
        rc = 0;
    }
    catch(CORBA::SystemException_catch& ex) {
        ex->_print(cerr);
        cerr << endl;
        rc = 1;
    }
    return rc;
}

char* GIOPTest_impl::peek() throw(::CORBA::SystemException)
{
    cout << "GIOPTest_impl::peek() " << lastToken << endl;
    return CORBA::string_dup(lastToken.c_str());
}

void GIOPTest_impl::onewayMethod() throw(::CORBA::SystemException) {
    lastToken = "onewayMethod";
    cout << lastToken << endl;
}

void GIOPTest_impl::sendBool(CORBA::Boolean v0, CORBA::Boolean v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendBool(" << (v0 ? "true" : "false") << "," << (v1 ? "true" : "false") << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendChar(CORBA::Char v0, CORBA::Char v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendChar(" << (int)v0 << "," << (int)v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendOctet(CORBA::Octet v0, CORBA::Octet v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendOctet(" << (unsigned)v0 << "," << (unsigned)v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendShort(CORBA::Short v0, CORBA::Short v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendShort(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendUShort(CORBA::UShort v0, CORBA::UShort v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendUShort(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendLong(CORBA::Long v0, CORBA::Long v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendLong(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendULong(CORBA::ULong v0, CORBA::ULong v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendULong(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendLongLong(CORBA::LongLong v0, CORBA::LongLong v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendLongLong(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendULongLong(CORBA::ULongLong v0, CORBA::ULongLong v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendULongLong(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendFloat(CORBA::Float v0, CORBA::Float v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendFloat(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendDouble(CORBA::Double v0, CORBA::Double v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendDouble(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendString(const char * v0, const char * v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendString(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendSequence(StringSequenceTmpl<CORBA::String_var> v0, SequenceTmpl<CORBA::Long,MICO_TID_DEF> v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendSequence([";
    for (CORBA::ULong i = 0; i < v0.length(); i++) {
        ss << v0[i] << ",";
    }
    ss << "],[";
    for (CORBA::ULong i = 0; i < v1.length(); i++) {
        ss << v1[i] << ",";
    }
    ss << "])";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendValuePoint(Point *v0) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendValuePoint(Point(" << v0->x() << "," << v0->y() << "))";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendValuePoints(Point *v0, Point *v1) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendValuePoints(Point(" << v0->x() << "," << v0->y() << "),Point(" << v1->x() << "," << v1->y() << "))";
    if (v0 == v1)
        ss << " // same object";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendObject(GIOPSmall_ptr obj, const char *msg) throw(::CORBA::SystemException) {
    cout << "sendObject(..., \"" << msg << "\")" << endl;
    obj->call(msg);
}

GIOPSmall_ptr GIOPTest_impl::getObject() throw(::CORBA::SystemException) {
    return 0;
}