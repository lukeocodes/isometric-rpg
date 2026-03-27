import { registry } from "../registry";
import { HumanBody } from "./HumanBody";
import { ElfBody } from "./ElfBody";
import { DwarfBody } from "./DwarfBody";
import { SkeletonBody } from "./SkeletonBody";
import { GoblinBody } from "./GoblinBody";
import { RabbitBody } from "./RabbitBody";
import { ImpBody } from "./ImpBody";
import { WolfBody } from "./WolfBody";

registry.register(new HumanBody());
registry.register(new ElfBody());
registry.register(new DwarfBody());
registry.register(new SkeletonBody());
registry.register(new GoblinBody());
registry.register(new RabbitBody());
registry.register(new ImpBody());
registry.register(new WolfBody());
