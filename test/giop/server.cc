#include <omniORB4/CORBA.h>
#include "giop.hh"
#include <iostream>
#include <fstream>
#include <sstream>

class GIOPTest_impl : public virtual POA_GIOPTest
{
public:
    virtual ~GIOPTest_impl() {}

    char *peek();
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
    // GIOPSmall_ptr getObject();
};
    
using namespace std;

const char *blank = "THIS PAGE INTENTIONALLY LEFT BLANK";
string lastToken(blank);

class Point_impl: virtual public OBV_Point, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Point_impl() {}
    Point_impl(double x, double y) {
      this->x(x);
      this->y(y);
    }
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
        servant->_remove_ref();

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
    cout << "GIOPTest_impl::peek() " << lastToken << endl;
    return CORBA::string_dup(lastToken.c_str());
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
    cout << "sendObject(..., \"" << msg << "\")roo" << endl;
    obj->call(msg);
}

// GIOPSmall_ptr GIOPTest_impl::getObject()
// {
//     return 0;
// }