import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { EfeitosDemo, DEMO_DUR } from "./EfeitosDemo";
import { MeuBagageiro2, MB2_DUR } from "./MeuBagageiro2";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition id="EfeitosDemo" component={EfeitosDemo} durationInFrames={DEMO_DUR} fps={30} width={1080} height={1920} />
      <Composition id="MeuBagageiro2" component={MeuBagageiro2} durationInFrames={MB2_DUR} fps={30} width={1080} height={1920} />
    </>
  );
};
