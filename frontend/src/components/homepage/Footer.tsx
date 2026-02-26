import {
  Eye,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Coins,
} from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[#070101] border-t border-border py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">
                Ajo.Save
              </span>
            </div>
            <p className=" text-sm sm:text-xl  text-muted-foreground mb-6 max-w-md">
              Ajo has been at the heart of African communities for generations.
              We’re bringing that trust to the blockchain.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* <div>
            <h3 className="text-foreground font-semibold mb-4">Platform</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-sm sm:text-xl  text-muted-foreground hover:text-primary transition-colors"
                >
                  Digital Ajo
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm sm:text-xl  text-muted-foreground hover:text-primary transition-colors"
                >
                  Transparency Engine
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm sm:text-xl  text-muted-foreground hover:text-primary transition-colors"
                >
                  Cultural NFTs
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm sm:text-xl  text-muted-foreground hover:text-primary transition-colors"
                >
                  Community
                </a>
              </li>
            </ul>
          </div> */}

          {/* <div>
            <h3 className="text-foreground font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-sm sm:text-xl  text-muted-foreground hover:text-primary transition-colors"
                >
                  Help Center
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm sm:text-xl  text-muted-foreground hover:text-primary transition-colors"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm sm:text-xl  text-muted-foreground hover:text-primary transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm sm:text-xl  text-muted-foreground hover:text-primary transition-colors"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div> */}
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center">
          <p className="text-sm sm:text-xl  text-muted-foreground">
            © 2025 Ajo.Save. All rights reserved. Built with ❤️ for Nigeria.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
