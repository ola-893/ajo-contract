import { Star } from "lucide-react";

const Testimonials = () => {
  return (
    <section
      id="community"
      className="py-24 relative"
      style={{ backgroundColor: "#070101" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-4">
            The Community Speaks
          </h2>
          <p className="text-sm lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            From Capetown to Kampala, Africans are using Ajo.Save to hold each
            other accountable, save transparently, and celebrate our culture.
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card/80 backdrop-blur-sm rounded-xl p-6 hover:bg-card transition-all hover:scale-105 border border-border"
            >
              {/* Star rating */}
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-accent fill-current" />
                ))}
              </div>

              {/* Testimonial text */}
              <p className="text-sm lg:text-lg mb-4 leading-relaxed text-foreground">
                “{testimonial.text}”
              </p>

              {/* Author */}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-sm font-bold text-white">
                  {testimonial.author.charAt(0)}
                </div>
                <div>
                  <div className=" text-sm lg:text-lg font-semibold text-foreground">
                    {testimonial.author}
                  </div>
                  <div className="text-sm lg:text-lg text-muted-foreground ">
                    {testimonial.location}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;

const testimonials = [
  {
    text: "Finally, a platform that can stop all those backdoor runs. With Ajo.Save, everything looks transparent via blockchain.",
    author: "Kemi O.",
    location: "Accra",
  },
  {
    text: "Our Ajo group has saved over ₦2 million without any issue. The trust and accountability is real.",
    author: "Chidi A.",
    location: "Lagos",
  },
  {
    text: "The cultural NFTs aren't just vibes. It is the real way to celebrate who we be as africans while stacking wealth.",
    author: "Aisha M.",
    location: "Johannesburg",
  },
];
