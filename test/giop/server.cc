#include <omniORB4/CORBA.h>
#include "giop.hh"
#include <iostream>
#include <fstream>
#include <sstream>
#include <climits>

class GIOPTest_impl : public virtual POA_GIOPTest
{
public:
    virtual ~GIOPTest_impl() {}

    char *peek();
    void call(::GIOPTest_ptr callback, CallbackType method);
    void onewayMethod();
    void sendBool(::CORBA::Boolean v0, ::CORBA::Boolean v1);
    void sendChar(::CORBA::Char v0, ::CORBA::Char v1);
    void sendOctet(::CORBA::Octet v0, ::CORBA::Octet v1);
    void sendShort(::CORBA::Short v0, ::CORBA::Short v1);
    void sendUShort(::CORBA::UShort v0, ::CORBA::UShort v1);
    void sendLong(::CORBA::Long v0, ::CORBA::Long v1);
    void sendULong(::CORBA::ULong v0, ::CORBA::ULong v1);
    void sendLongLong(::CORBA::LongLong v0, ::CORBA::LongLong v1);
    void sendULongLong(::CORBA::ULongLong v0, ::CORBA::ULongLong v1);
    void sendFloat(::CORBA::Float v0, ::CORBA::Float v1);
    void sendDouble(::CORBA::Double v0, ::CORBA::Double v1);
    void sendString(const char *v0, const char *v1);
    void sendSequence(const StringSeq &v0, const LongSeq &v1);
    void sendValuePoint(::Point *v0);
    void sendValuePoints(::Point *v0, ::Point *v1);

    void sendObject(::GIOPSmall_ptr obj, const char *msg);
    GIOPSmall_ptr getObject();
};

class GIOPSmall_impl : public virtual POA_GIOPSmall
{
public:
    virtual ~GIOPSmall_impl() {}
    void call(const char *msg);
};

using namespace std;

const char *blank = "THIS PAGE INTENTIONALLY LEFT BLANK";
string lastToken(blank);

GIOPSmall_var small;

class Point_impl: virtual public OBV_Point, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Point_impl() {}
    Point_impl(double x, double y) {
      this->x(x);
      this->y(y);
    }
    ~Point_impl() {}
};

int main(int argc, char **argv)
{
    int rc = 0;
    try
    {
        // create ORB
        CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);

        // register valuetype
        class PointFactory: public virtual CORBA::ValueFactoryBase {
            CORBA::ValueBase* create_for_unmarshal() { return new Point_impl(); }
        };
        orb->register_value_factory("IDL:Point:1.0", new PointFactory());

        // rootPOA
        CORBA::Object_var obj = orb->resolve_initial_references("RootPOA");
        PortableServer::POA_var rootPOA = PortableServer::POA::_narrow(obj);

        // activate POA manager
        PortableServer::POAManager_var pman = rootPOA->the_POAManager();
        pman->activate();

        // bidirPOA
        CORBA::PolicyList pl;
        pl.length(1);
        CORBA::Any a;
        a <<= BiDirPolicy::BOTH;
        pl[0] = orb->create_policy(BiDirPolicy::BIDIRECTIONAL_POLICY_TYPE, a);
        PortableServer::POA_var bidirPOA = rootPOA->create_POA("bidir", pman, pl);
        // const bidirPOA = rootPOA

        // create GIOPTest on bidirPOA
        PortableServer::Servant_var<GIOPTest_impl> servant = new GIOPTest_impl();
        PortableServer::ObjectId_var oid = bidirPOA->activate_object(servant);
        obj = servant->_this();
        // servant->_remove_ref();

        PortableServer::Servant_var<GIOPSmall_impl> smallServant = new GIOPSmall_impl();
        bidirPOA->activate_object(smallServant);
        small = smallServant->_this();

        // store GIOPTest's IOR
        CORBA::String_var ior = orb->object_to_string(obj);
        ofstream out("IOR.txt");
        out << ior << endl;
        out.close();

        cout << "start server ORB" << endl;
        orb->run();
    }
    catch (CORBA::SystemException &ex)
    {
        cerr << "Caught CORBA::" << ex._name() << endl;
        rc = 1;
    }
    catch (CORBA::Exception &ex)
    {
        cerr << "Caught CORBA::Exception: " << ex._name() << endl;
        rc = 1;
    }
    return rc;
}

char *GIOPTest_impl::peek()
{
    cout << "GIOPTest_impl::peek() -> " << lastToken << endl;
    return CORBA::string_dup(lastToken.c_str());
}

void GIOPTest_impl::call(::GIOPTest_ptr callback, CallbackType method) {
    switch(method) {
        case CB_BOOL:
            cout << "GIOPTest_impl::call(...,CB_BOOL)" << endl;
            callback->sendBool(false, true);
            break;
        case CB_CHAR:
            cout << "GIOPTest_impl::call(...,CB_CHAR)" << endl;
            callback->sendChar(0, 255);
            break;
        case CB_OCTET:
            cout << "GIOPTest_impl::call(...,CB_OCTET)" << endl;
            callback->sendOctet(0, 255);
            break;
        case CB_SHORT:
            cout << "GIOPTest_impl::call(...,CB_SHORT)" << endl;
            callback->sendShort(-32768, 32767);
            break;
        case CB_USHORT:
            cout << "GIOPTest_impl::call(...,CB_USHORT)" << endl;
            callback->sendUShort(0, 65535);
            break;
        case CB_LONG:
            cout << "GIOPTest_impl::call(...,CB_LONG)" << endl;
            callback->sendLong(-2147483648L, 2147483647L);
            break;
        case CB_ULONG:
            cout << "GIOPTest_impl::call(...,CB_ULONG)" << endl;
            callback->sendULong(0, 4294967295L);
            break;
        case CB_LONGLONG:
            cout << "GIOPTest_impl::call(...,CB_LONGLONG)" << endl;
            callback->sendLongLong(LLONG_MAX, LLONG_MIN);
            break;
        case CB_ULONGLONG:
            cout << "GIOPTest_impl::call(...,CB_ULONGLONG)" << endl;
            callback->sendULongLong(0, 18446744073709551615LLU);
            break;
        case CB_FLOAT:
            cout << "GIOPTest_impl::call(...,CB_FLOAT)" << endl;
            callback->sendFloat(1.17549e-38, 3.40282e+38);
            break;
        case CB_DOUBLE:
            cout << "GIOPTest_impl::call(...,CB_DOUBLE)" << endl;
            callback->sendDouble(4.94066e-324, 1.79769e+308);
            break;
        case CB_STRING:
            cout << "GIOPTest_impl::call(...,CB_STRING)" << endl;
            callback->sendString("hello", "you");
            break;
        case CB_SEQUENCE: {
            cout << "GIOPTest_impl::call(...,CB_SEQUENCE)" << endl;
            StringSeq seq0; // yeah... CORBA's C++ mapping has it's own containers
            seq0.length(2); // yeah, CORBA's C++ mapping has no no append() nor seq0(2) work here
            seq0[0] = CORBA::string_dup("hello"); // yeah, CORBA's C++ mapping needs a duplicate of the string
            seq0[1] = CORBA::string_dup("you");
            LongSeq seq1;
            seq1.length(3);
            seq1[0] = 1138;
            seq1[1] = 1984;
            seq1[2] = 2001;
            callback->sendSequence(seq0, seq1);
        } break;
        case CB_VALUE: {
            cout << endl << "-------------------------------------" << endl;
            cout << "GIOPTest_impl::value(...,CB_VALUE)" << endl;
            Point_impl *point = new Point_impl(20, 30);
            CORBA::add_ref(point);
            callback->sendValuePoint(point);
        } break;
        case CB_VALUES_DUPLICATE_REPOSITORY_ID:
            cout << "GIOPTest_impl::value(...,CB_VALUES_DUPLICATE_REPOSITORY_ID)" << endl;
            callback->sendOctet(0, 255);
            break;
        case CB_VALUES_DUPLICATE_OBJECT:
            cout << "GIOPTest_impl::value(...,CB_VALUES_DUPLICATE_OBJECT)" << endl;
            callback->sendOctet(0, 255);
            break;
        case CB_SEND_OBJECT:
            cout << "GIOPTest_impl::call(...,CB_SEND_OBJECT)" << endl;
            callback->sendOctet(0, 255);
            break;
        case CB_GET_OBJECT:
            cout << "GIOPTest_impl::call(...,CB_GET_OBJECT)" << endl;
            callback->sendOctet(0, 255);
            break;
        default:
            cout << "GIOPTest_impl::call(...," << method << ") ;; not implemented" << endl;
    }
}

void GIOPTest_impl::onewayMethod()
{
    lastToken = "onewayMethod";
    cout << lastToken << endl;
}

void GIOPTest_impl::sendBool(CORBA::Boolean v0, CORBA::Boolean v1)
{
    std::stringstream ss;
    ss << "sendBool(" << (v0 ? "true" : "false") << "," << (v1 ? "true" : "false") << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendChar(CORBA::Char v0, CORBA::Char v1)
{
    std::stringstream ss;
    ss << "sendChar(" << (int)v0 << "," << (int)v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendOctet(CORBA::Octet v0, CORBA::Octet v1)
{
    std::stringstream ss;
    ss << "sendOctet(" << (unsigned)v0 << "," << (unsigned)v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendShort(CORBA::Short v0, CORBA::Short v1)
{
    std::stringstream ss;
    ss << "sendShort(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendUShort(CORBA::UShort v0, CORBA::UShort v1)
{
    std::stringstream ss;
    ss << "sendUShort(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendLong(CORBA::Long v0, CORBA::Long v1)
{
    std::stringstream ss;
    ss << "sendLong(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendULong(CORBA::ULong v0, CORBA::ULong v1)
{
    std::stringstream ss;
    ss << "sendULong(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendLongLong(CORBA::LongLong v0, CORBA::LongLong v1)
{
    std::stringstream ss;
    ss << "sendLongLong(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendULongLong(CORBA::ULongLong v0, CORBA::ULongLong v1)
{
    std::stringstream ss;
    ss << "sendULongLong(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendFloat(CORBA::Float v0, CORBA::Float v1)
{
    std::stringstream ss;
    ss << "sendFloat(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendDouble(CORBA::Double v0, CORBA::Double v1)
{
    std::stringstream ss;
    ss << "sendDouble(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendString(const char *v0, const char *v1)
{
    std::stringstream ss;
    ss << "sendString(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendSequence(const StringSeq &v0, const LongSeq &v1) {
// void GIOPTest_impl::sendSequence(StringSequenceTmpl<CORBA::String_var> v0, SequenceTmpl<CORBA::Long,MICO_TID_DEF> v1) {
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

void GIOPTest_impl::sendValuePoint(Point *v0)
{
    std::stringstream ss;
    ss << "sendValuePoint(Point(" << v0->x() << "," << v0->y() << "))";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendValuePoints(Point *v0, Point *v1)
{
    std::stringstream ss;
    ss << "sendValuePoints(Point(" << v0->x() << "," << v0->y() << "),Point(" << v1->x() << "," << v1->y() << "))";
    if (v0 == v1)
        ss << " // same object";
    lastToken = ss.str();
    cout << lastToken << endl;
}

void GIOPTest_impl::sendObject(GIOPSmall_ptr obj, const char *msg)
{
    cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
    cout << "sendObject(..., \"" << msg << "\")" << endl;
    obj->call(msg);
}

GIOPSmall_ptr GIOPTest_impl::getObject()
{
    return GIOPSmall::_duplicate(small);
}

void GIOPSmall_impl::call(const char *msg)
{
    lastToken = string(msg);
    cout << lastToken << endl;
}
