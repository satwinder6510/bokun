import minimalistHero from "@assets/generated_images/minimalist_single_image_hero.png";
import destinationsGrid from "@assets/generated_images/featured_destinations_grid_hero.png";
import splitLayout from "@assets/generated_images/split_layout_hero_design.png";
import compactHero from "@assets/generated_images/compact_hero_with_package_cards.png";

export default function HeroConcepts() {
  const concepts = [
    {
      title: "Option 1: Minimalist Single Image Hero",
      image: minimalistHero,
      description: "Single curated background image you control. Clean headline with search/CTA. Much faster loading - just one optimized image."
    },
    {
      title: "Option 2: Featured Destinations Grid",
      image: destinationsGrid,
      description: "Grid of clickable destination cards. Each shows destination name + starting price. You control which destinations appear and in what order."
    },
    {
      title: "Option 3: Split Layout",
      image: splitLayout,
      description: "Image on one side, content on the other. Featured deal/package prominently displayed. More focused - highlights one key offering."
    },
    {
      title: "Option 4: Compact Hero + Featured Packages",
      image: compactHero,
      description: "Smaller hero banner at top. Row of featured package cards below. Gets content above the fold faster. You control which packages are featured."
    }
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Homepage Hero Alternatives</h1>
        <p className="text-muted-foreground mb-8">
          These are concept designs to replace the current carousel. All options give you admin control over what's displayed.
        </p>
        
        <div className="space-y-12">
          {concepts.map((concept, index) => (
            <div key={index} className="border rounded-lg overflow-hidden bg-card">
              <div className="p-4 border-b">
                <h2 className="text-xl font-semibold">{concept.title}</h2>
                <p className="text-muted-foreground mt-1">{concept.description}</p>
              </div>
              <img 
                src={concept.image} 
                alt={concept.title}
                className="w-full"
              />
            </div>
          ))}
        </div>
        
        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Benefits of all options:</h3>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Faster page load (no carousel JavaScript, fewer images)</li>
            <li>Admin control over what's displayed</li>
            <li>Cleaner, more modern look</li>
            <li>Mobile-friendly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
