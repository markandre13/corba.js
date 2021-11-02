#include <omniORB4/CORBA.h>
#include "giop.hh"
#include <iostream>
#include <fstream>
#include <sstream>

using namespace std;

const char *blank = "THIS PAGE INTENTIONALLY LEFT BLANK";
string lastToken(blank);

class Point_impl : public virtual OBV_Point, public virtual CORBA::DefaultValueRefCountBase
{
public:
    Point_impl() : OBV_Point() {}
    Point_impl(CORBA::Long x, CORBA::Long y) : OBV_Point(x, y) {}
    ~Point_impl() {}

    char *toString();
};

char *Point_impl::toString()
{
    std::stringstream ss;
    ss << "Point(" << this->x() << "," << this->y() << ")";
    lastToken = ss.str();
    return (char *)lastToken.c_str();
}

class NamedPoint_impl : public virtual OBV_NamedPoint, public virtual CORBA::DefaultValueRefCountBase
{
public:
    NamedPoint_impl() {}
    // yeah, you'd guess that OBV_NamedPoint(x, y, name) would initialize x and y... but it doesn't
    NamedPoint_impl(CORBA::Long x, CORBA::Long y, const char *name) : OBV_Point(x, y), OBV_NamedPoint(x, y, name) {}
    ~NamedPoint_impl() {}
    char *toString();
};

char *NamedPoint_impl::toString()
{
    std::stringstream ss;
    ss << "NamedPoint(" << this->x() << "," << this->y() << ",\"" << this->name() << "\")";
    lastToken = ss.str();
    return (char *)lastToken.c_str();
}

class GIOPSmall_impl : public virtual POA_GIOPSmall
{
public:
    virtual ~GIOPSmall_impl() {}
    void call(const char *msg);
};

void GIOPSmall_impl::call(const char *msg)
{
    cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
    cout << "GIOPSmall::call(\"" << msg << "\")" << endl;
}

class FigureModel_impl : public virtual OBV_FigureModel, public virtual CORBA::DefaultValueRefCountBase
{
public:
    FigureModel_impl() {}
    // yeah, you'd guess that OBV_NamedPoint(x, y, name) would initialize x and y... but it doesn't
    FigureModel_impl(::FigureSeq& data) : OBV_FigureModel(data) {}
    ~FigureModel_impl() {}
};

int main(int argc, char **argv)
{
    int rc = 0;
    try
    {
        CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);

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

        // create GIOPTest on bidirPOA
        PortableServer::Servant_var<GIOPSmall_impl> servant = new GIOPSmall_impl();
        bidirPOA->activate_object(servant);
        GIOPSmall_var small = servant->_this();
        // servant->_remove_ref();

        class FigureModelFactory : public virtual CORBA::ValueFactoryBase
        {
            CORBA::ValueBase *create_for_unmarshal() { return new FigureModel_impl(); }
        };
        orb->register_value_factory("IDL:FigureModel:1.0", new FigureModelFactory());

#if 0
        ifstream in("IOR.txt");
        char s[1000];
        in >> s;
        in.close();
        // const char *s = "corbaname::192.168.1.105:#TestService";
        obj = orb->string_to_object(s);

        GIOPTest_var server = GIOPTest::_narrow(obj);
        cout << "got Server object" << endl;
#else
        // naming service via initial reference
        // CORBA::Object_var ns0 = orb->resolve_initial_references("NameService");
        
        // naming service via host:port (defaults to iiop v1.0)
        // CORBA::Object_var ns0 = orb->string_to_object("corbaloc:iiop:192.168.1.10/NameService");

        // CosNaming::NamingContext_var rootContext;
        // rootContext = CosNaming::NamingContext::_narrow(ns0);
        // if (CORBA::is_nil(rootContext))
        // {
        //     cerr << "Failed to narrow the root naming context." << endl;
        //     exit(1);
        // }
        // CosNaming::Name objectName;
        // objectName.length(1);
        // objectName[0].id = "TestService";
        // objectName[0].kind = "Object";
        // obj = rootContext->resolve(objectName);

        // object from naming service at host:port
        // obj = orb->string_to_object("corbaname::192.168.1.10/NameService#TestService");
        obj = orb->string_to_object("corbaname::192.168.1.10#TestService");

        GIOPTest_var server = GIOPTest::_narrow(obj);
        cout << "got Server object" << endl;
#endif
        cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
        // server->onewayMethod();
        // server->sendBool(false, true);
        // server->sendValuePoint(new Point_impl(3.1415, 2.17));
        // cout << server->peek() << endl;
        // server->sendObject(small, "foo");

        // elements in list can be null

        FigureSeq seq;
        seq.length(1);
        // seq[0] = new OBV_Rectangle(10, new OBV_Origin(10, 20), new OBV_Size(30, 40));
        seq[0] = new OBV_Rectangle(10, 0, new OBV_Size(30, 40));
        // seq[1] = new OBV_Rectangle(11, new OBV_Origin(50, 60), new OBV_Size(70, 80));
        server->setFigureModel(new OBV_FigureModel(seq));
        // server->setFigureModel(0);

        cout << "<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<" << endl;

        orb->destroy();
    }
    catch (CORBA::TRANSIENT &)
    {
        cerr << "Caught system exception TRANSIENT -- unable to contact the "
             << "server." << endl;
        rc = 1;
    }
    catch (CORBA::SystemException &ex)
    {
        cerr << "Caught a CORBA::" << ex._name() << endl;
        rc = 1;
    }
    catch (CORBA::Exception &ex)
    {
        cerr << "Caught CORBA::Exception: " << ex._name() << endl;
        rc = 1;
    }
    return rc;
}
