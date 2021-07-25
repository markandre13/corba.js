#include "test.h"
#include <iostream>

#if 0
namespace toad {
    class Rectangle: public OBV_Rectangle {
        public:
            Rectangle() {}
            Rectangle(CORBA::Double _x, CORBA::Double _y, CORBA::Double _w, CORBA::Double _h):
                OBV_Rectangle(_x, _y, _w, _h)
            {}
            void _add_ref() override {
//                std::cout << "ttoad::Rectangle::_add_ref()" << std::endl;
            }
            void _remove_ref() override {
//                std::cout << "toad::Rectangle::_remove_ref()" << std::endl;
            }
            CORBA::ULong _refcount_value() override {
//                std::cout << "toad::Rectangle::_refcount_value()" << std::endl;
                return 1;
            }
            void paint() override {
                std::cout << "toad::Rectangle::paint()" << std::endl;
            }
    };
    
    class RectangleFactory: public Rectangle_init {
        public:
            Rectangle* create(CORBA::Double x, CORBA::Double y, CORBA::Double w, CORBA::Double h) override {
//                std::cout << "RectangleFactory::create(...)" << std::endl;
                return new Rectangle(x, y, w, h);
            }
            CORBA::ValueBase* create_for_unmarshal() override {
//                std::cout << "RectangleFactory::create_for_unmarshal(...)" << std::endl;
                return new Rectangle();
            }
    };
    
//    auto *factory = new toad::RectangleFactory();
//    orb->register_value_factory("IDL:Rectangle:1.0", factory);

}
#endif
