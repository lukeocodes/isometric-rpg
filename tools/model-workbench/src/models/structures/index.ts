import { registry } from "../registry";
import { WallN } from "./WallN";
import { WallS } from "./WallS";
import { WallW } from "./WallW";
import { WallE } from "./WallE";

registry.register(new WallN());
registry.register(new WallS());
registry.register(new WallW());
registry.register(new WallE());
