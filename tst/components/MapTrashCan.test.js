import { createRef } from 'react';
import { render } from '@testing-library/react';
import { MapTrashCan } from '../../src/components/MapTrashCan';

const draw = props => {
    const ref = createRef();
    const view = render(<MapTrashCan ref={ref} carrying={false} hot={false} {...props}/>);
    return { ...view, ref, can: () => ref.current };
};

describe('MapTrashCan', () => {
    test('is not showing until a token is carried', () => {
        const { can } = draw();
        expect(can()).toHaveClass('MapTrash');
        expect(can()).not.toHaveClass('MapTrash-visible');
    });

    test('shows while one is carried, and says what to do', () => {
        const { can } = draw({ carrying: true });
        expect(can()).toHaveClass('MapTrash-visible');
        expect(can()).toHaveTextContent('Drop here to remove');
        expect(can()).not.toHaveClass('MapTrash-hot');
    });

    test('lights up, and says to let go, when the token is over it', () => {
        const { can } = draw({ carrying: true, hot: true });
        expect(can()).toHaveClass('MapTrash-hot');
        expect(can()).toHaveTextContent('Let go to remove');
    });

    test('hands its element to the ref, for measuring where it is', () => {
        const { ref } = draw();
        expect(ref.current).toBeInstanceOf(HTMLElement);
    });

    test('is not a control: it is hidden from assistive tech, and the same things are done from the toolbar', () => {
        const { can } = draw({ carrying: true });
        expect(can()).toHaveAttribute('aria-hidden', 'true');
    });
});
