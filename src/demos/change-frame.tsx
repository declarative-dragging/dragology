import { demo } from "../demo";
import { DemoDraggable, DemoNotes } from "../demo/ui";
import { Draggable } from "../draggable";
import { param } from "../DragSpec";
import { Vec2 } from "../math/vec2";
import { rotateDeg, translate } from "../svgx/helpers";

type State = {
  angle: number;
};

const initialState: State = { angle: -45 };

const CENTER = Vec2(150, 150);
const RADIUS = 100;

const draggable: Draggable<State> = ({ state, d }) => (
  <g transform={translate(CENTER)}>
    <circle r={RADIUS} fill="none" stroke="#ccc" strokeWidth={2} />
    <line x1={-RADIUS - 20} x2={RADIUS + 20} stroke="#eee" strokeWidth={1} />
    <g transform={rotateDeg(state.angle)}>
      <circle
        id="point"
        transform={translate(RADIUS, 0)}
        r={12}
        fill="black"
        dragologyOnDrag={() =>
          d
            .vary(state, param("angle"))
            // Flip the pointer upside down, across the circle's center.
            .changeFrame(({ pointer }) => ({
              pointer: Vec2(pointer.x, 2 * CENTER.y - pointer.y),
            }))
        }
      />
    </g>
  </g>
);

export default demo(
  () => (
    <div>
      <DemoNotes>
        <p>
          <code>spec.changeFrame</code> changes the frame a spec is given. Here
          a <code>d.vary</code> moving a point around a circle is given the
          pointer flipped upside down, so the point follows the cursor's
          reflection. Turn on the Overlay to see the flipped pointer, which is
          the one <code>vary</code> measures its gap to.
        </p>
      </DemoNotes>
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={300}
        height={300}
      />
    </div>
  ),
  { tags: ["spec.changeFrame", "d.vary"] },
);
