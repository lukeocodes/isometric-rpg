import { registry } from "../registry";
import { HumanBody } from "./HumanBody";
import { ElfBody } from "./ElfBody";
import { DwarfBody } from "./DwarfBody";
import { SkeletonBody } from "./SkeletonBody";
import { GoblinBody } from "./GoblinBody";
import { RabbitBody } from "./RabbitBody";
import { ImpBody } from "./ImpBody";
import { WolfBody } from "./WolfBody";
import { OgreBody } from "./OgreBody";
import { WraithBody } from "./WraithBody";
import { BearBody } from "./BearBody";
import { KingRabbit } from "./KingRabbit";
import { SkeletonLord } from "./SkeletonLord";
import { AlphaWolf } from "./AlphaWolf";

registry.register(new HumanBody());
registry.register(new ElfBody());
registry.register(new DwarfBody());
registry.register(new SkeletonBody());
registry.register(new GoblinBody());
registry.register(new RabbitBody());
registry.register(new ImpBody());
registry.register(new WolfBody());
registry.register(new OgreBody());
registry.register(new WraithBody());
registry.register(new BearBody());
registry.register(new KingRabbit());
registry.register(new SkeletonLord());
registry.register(new AlphaWolf());

import { GoblinChieftain } from "./GoblinChieftain";
import { ImpOverlord } from "./ImpOverlord";
import { ElderBear } from "./ElderBear";

registry.register(new GoblinChieftain());
registry.register(new ImpOverlord());
registry.register(new ElderBear());

import { GnomeBody } from "./GnomeBody";
registry.register(new GnomeBody());
